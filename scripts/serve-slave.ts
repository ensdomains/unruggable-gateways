import type { Serve } from 'bun';
import { OPFaultRollup } from '../src/op/OPFaultRollup.js';
import { SlaveGateway } from '../src/slave.js';
import { flattenErrors, toUnpaddedHex } from '../src/utils.js';
import { parseArgs } from 'node:util';
import { EthProver } from '../src/eth/EthProver.js';
import {
  findLeaf,
  followSlot,
  getProof,
  getRootHash,
  insertBytes,
  insertNode,
  keccak256,
  MaybeNode,
  toBytes,
  toHex,
  toNibblePath,
  trimLeadingZeros,
} from '../../merkle-builder/src/index.js';
import { RPCEthGetBlock, RPCEthGetProof } from '../src/eth/types.js';
import { HexString } from '@namestone/ezccip';
import { HexAddress } from '../src/types.js';

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

const port = parseInt(args.values.port);
console.log(`Port: ${port}`);

let block0 = 0;
const NAMES: [number, string, string][] = [];

const gateway = new SlaveGateway(
  ['http://localhost:8050'], // args.positionals,
  async (masterObj, commitObj) => {
    const { proof, block, owner, commit } = masterObj as {
      block: RPCEthGetBlock;
      proof: RPCEthGetProof;
      owner: HexAddress | null;
      commit: object;
    };
    Object.assign(commitObj, commit);
    const node = await createNode(parseInt(block.number), owner);
    function checkContext(target: any, blockTag: any) {
      if (target !== proof.address) {
        throw new Error(`unsupported contract: ${target}`);
      }
      if (blockTag !== block.number) {
        throw new Error(`unsupported block: ${blockTag}`);
      }
    }
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

async function createNode(block1: number, owner: HexString | null) {
  while (block0 < block1) {
    const { nextBlock, names } = await gateway.fetchMaster<{
      nextBlock: number;
      names: typeof NAMES;
    }>(`/names.json?block=${block0}&limit=10000`);
    console.log(`${block0} => ${nextBlock - 1} (${names.length})`);
    NAMES.push(...names);
    block0 = nextBlock;
  }
  console.log(`Loaded: ${NAMES.length}`);
  console.time('buildTrie');
  let node: MaybeNode = undefined;
  for (const [block, addr, name] of NAMES) {
    if (block > block1) break;
    node = insertBytes(node, getPrimarySlot(addr), Buffer.from(name));
  }
  if (owner) {
    node = insertNode(
      node,
      toNibblePath(keccak256(toBytes(1, 32))),
      trimLeadingZeros(toBytes(owner))
    );
  }
  console.log(`StorageHash: ${toHex(getRootHash(node))}`);
  console.timeEnd('buildTrie');
  return node;
}

function getPrimarySlot(addr: string) {
  return followSlot(0n, toBytes(addr, 32));
}
