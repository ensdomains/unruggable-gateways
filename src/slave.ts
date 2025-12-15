import { EZCCIP } from '@namestone/ezccip';

import { GATEWAY_ABI } from './gateway.js';
import { CachedValue, LRU } from './cached.js';
import { solidityPackedKeccak256 } from 'ethers/hash';
import { AbstractProver, CallbackError } from './vm.js';
import { getBytes } from 'ethers/utils';
import { toUnpaddedHex } from './utils.js';
import { HexString, ProofSequence } from './types.js';

type SlaveCommit = {
  index: bigint;
  prover: AbstractProver;
  gatewayState: 'unstarted' | 'success' | 'failure';
};

export class SlaveGateway extends EZCCIP {
  readonly latestCache = new CachedValue(async () => {
    const info = await this.fetchMaster<{
      commits: string[];
    }>('/');
    const active = new Set(info.commits.map((x) => BigInt(x)));
    const map = new Map(this.commits.map((x) => [x.index, x]));
    for (const x of map.values()) {
      if (x.gatewayState === 'failure' || !active.has(x.index)) {
        map.delete(x.index);
      }
    }
    for (const index of active) {
      if (!map.has(index)) {
        const commit: SlaveCommit = {
          index,
          prover: undefined as any,
          gatewayState: 'unstarted',
        };
        (async () => {
          try {
            commit.prover = await this.commitDecoder(
              await this.fetchMaster<object>(
                `/commit.json?index=${toUnpaddedHex(index)}`
              ),
              commit
            );
            commit.gatewayState = 'success';
          } catch (err) {
            commit.gatewayState = 'failure';
            console.log(err);
          }
        })();
        map.set(index, commit);
      }
    }
    this.commits.length = 0;
    const sorted = [...map.values()].sort((a, b) =>
      a.index > b.index ? -1 : 1
    );
    this.commits.push(...sorted);
  }, 30000);

  readonly commits: SlaveCommit[] = [];
  readonly callLRU = new LRU<string, Uint8Array>(1000);
  constructor(
    readonly gateways: string[],
    readonly commitDecoder: (
      masterObj: object,
      commitObj: object
    ) => Promise<AbstractProver>,
    witnessEncoder: (commit: any, proofSeq: ProofSequence) => HexString
  ) {
    super();
    this.register(GATEWAY_ABI, {
      proveRequest: async ([ctx, [req]], _context, history) => {
        const commit = this.getRecentCommit(BigInt(ctx.slice(0, 66)));
        const hash = solidityPackedKeccak256(
          ['uint256', 'bytes'],
          [commit.index, req]
        );
        history.show = [commit.index, hash];
        return this.callLRU.cache(hash, async () => {
          try {
            const state = await commit.prover.evalDecoded(req);
            const proofSeq = await commit.prover.prove(state.needs);
            return getBytes(witnessEncoder(commit, proofSeq));
          } catch (err: unknown) {
            if (err instanceof CallbackError) {
              return getBytes(err.data);
            }
            throw err;
          }
        });
      },
    });
  }
  getRecentCommit(index: bigint): SlaveCommit {
    for (const commit of this.commits) {
      if (index >= commit.index && commit.gatewayState === 'success') {
        return commit;
      }
    }
    throw new Error(`too old: ${index} vs ${this.commits.map((x) => x.index)}`);
  }
  async fetchMaster<T>(urlSuffix: string): Promise<T> {
    for (const url of this.gateways) {
      const res = await fetch(url + urlSuffix);
      if (!res.ok) continue;
      try {
        return await res.json();
      } catch {
        // ignore
      }
    }
    throw new Error('all masterGateways failed!');
  }
}
