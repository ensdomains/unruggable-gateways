import type { Serve } from 'bun';
import type { HexAddress } from '../src/types.js';
import { parseArgs } from 'node:util';
import { OPFaultRollup } from '../src/op/OPFaultRollup.js';
import { Fetcher, SlaveGateway } from '../src/gateway-slave.js';
import { flattenErrors, toUnpaddedHex } from '../src/utils.js';
import { EthProver } from '../src/eth/EthProver.js';
import { RPCEthGetBlock, RPCEthGetProof } from '../src/eth/types.js';
import {
  type MaybeNode,
  findLeaf,
  followSlot,
  getProof,
  getRootHash,
  insertBytes,
  insertNode,
  keccak256,
  toBytes,
  toHex,
  toNibblePath,
  trimLeadingZeros,
} from '../../merkle-builder/src/index.js';
import { CachedValue } from '../src/cached.js';

const args = parseArgs({
  allowPositionals: true,
  options: {
    port: {
      type: 'string',
      short: 'p',
      default: '8000',
    },
  },
});

const fetcher = new Fetcher(['http://localhost:8050']);

const port = parseInt(args.values.port);
console.log(`Port: ${port}`);

let block0 = 0;
const NAMES: [number, string, string][] = [];

const syncNames = new CachedValue(async () => {
  const t0 = Date.now();
  while (true) {
    const { nextBlock, names } = await fetcher.fetchJson<{
      nextBlock: number;
      names: typeof NAMES;
    }>(`/names.json?block=${block0}&limit=5000`);
    if (!names.length) break;
    console.log(`${block0} => ${nextBlock - 1} (${names.length})`);
    NAMES.push(...names);
    block0 = nextBlock;
  }
  console.log(`syncNames: ${NAMES.length} <${Date.now() - t0}ms>`);
});

const gateway = new SlaveGateway(
  fetcher, // args.positionals,
  async (index, masterObj, commitObj) => {
    console.log('Commit:', index);
    console.time('commit');
    const { proof, block, owner, commit } = masterObj as {
      block: RPCEthGetBlock;
      proof: RPCEthGetProof;
      owner: HexAddress | null;
      commit: object;
    };
    Object.assign(commitObj, commit);
    await syncNames.get();
    console.time('buildTrie');
    let node: MaybeNode = undefined;
    const block1 = parseInt(block.number);
    for (const [block, addr, name] of NAMES) {
      if (block > block1) break;
      node = insertBytes(
        node,
        followSlot(0n, toBytes(addr, 32)),
        Buffer.from(name)
      );
    }
    if (owner) {
      node = insertNode(
        node,
        toNibblePath(keccak256(toBytes(1, 32))),
        trimLeadingZeros(toBytes(owner))
      );
    }
    console.timeEnd('buildTrie');
    console.time('hashTrie');
    console.log({
      index,
      block1,
      stateRoot: block.stateRoot,
      storageRoot: toHex(getRootHash(node)),
    });
    console.timeEnd('hashTrie');
    console.timeEnd('commit');
    return new EthProver(
      {
        async send(method, params) {
          if (Array.isArray(params)) {
            switch (method) {
              case 'eth_getStorageAt': {
                checkContext(params[0], params[2]);
                const slot = toBytes(params[1], 32);
                const path = toNibblePath(keccak256(slot));
                const leaf = findLeaf(node, path);
                const word = new Uint8Array(32);
                if (leaf) word.set(leaf.value, 32 - leaf.value.length);
                return toHex(word);
              }
              case 'eth_getProof': {
                checkContext(params[0], params[2]);
                const storageProof = params[1].map((hexSlot: string) => {
                  const slot = toBytes(hexSlot, 32);
                  const path = toNibblePath(keccak256(slot));
                  const leaf = findLeaf(node, path);
                  return {
                    key: toHex(slot),
                    value: leaf?.value.length ? toHex(leaf.value) : '0x0',
                    proof: getProof(node, path).map((v) => toHex(v)),
                  };
                });
                return { ...proof, storageProof };
              }
            }
          }
          throw new Error('not implemented');
        },
      },
      block.number
    );
    function checkContext(target: any, blockTag: any) {
      if (target !== proof.address) {
        throw new Error(`unsupported contract: ${target}`);
      }
      if (blockTag !== block.number) {
        throw new Error(`unsupported block: ${blockTag}`);
      }
    }
  },
  OPFaultRollup.encodeWitness
);

const prefetch = async () => {
  try {
    console.time('prefetch');
    await gateway.latestCache.get();
    console.timeEnd('prefetch');
  } catch (err) {
    console.log(new Date(), `Prefetch failed: ${flattenErrors(err, String)}`);
  }
  setTimeout(prefetch, gateway.latestCache.cacheMs);
};
await prefetch();

const headers = { 'access-control-allow-origin': '*' };
export default {
  port,
  async fetch(req) {
    switch (req.method) {
      case 'OPTIONS': {
        return new Response(null, {
          headers: { ...headers, 'access-control-allow-headers': '*' },
        });
      }
      case 'GET': {
        const { gateways } = gateway;
        const commits = gateway.commits.map((x) => ({
          index: toUnpaddedHex(x.index),
        }));
        return Response.json({ gateways, commits }, { headers });
      }
      case 'POST': {
        const t0 = performance.now();
        try {
          const { sender, data: calldata } = await req.json();
          const { data, history } = await gateway.handleRead(sender, calldata, {
            protocol: 'raw',
          });
          console.log(
            new Date(),
            history.toString(),
            Math.round(performance.now() - t0)
          );
          return Response.json({ data }, { headers });
        } catch (err) {
          console.log(new Date(), flattenErrors(err, String));
          return Response.json(
            { error: flattenErrors(err) },
            { headers, status: 500 }
          );
        }
      }
      default: {
        return new Response('unsupported', { status: 405 });
      }
    }
  },
} satisfies Serve;
