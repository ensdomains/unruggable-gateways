import type { Serve } from 'bun';
import { parseArgs } from 'node:util';
import { toUtf8String } from 'ethers';
import { OPFaultRollup } from '../src/op/OPFaultRollup.js';
import { SlaveGateway } from '../src/gateway-slave.js';
import { Fetcher } from '../src/fetcher.js';
import { flattenErrors, toUnpaddedHex } from '../src/utils.js';
import { EthProver } from '../src/eth/EthProver.js';
import type { RPCEthGetBlock, RPCEthGetProof } from '../src/eth/types.js';
import {
  Coder,
  type MaybeNode,
  copyNode,
  findLeaf,
  getProof,
  graftLimb,
  keccak256,
  toBytes,
  toHex,
  toNibblePath,
} from '@ensdomains/merkle-builder';

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

const gateway = new SlaveGateway(
  fetcher,
  async (index, commitObj) => {
    console.log('Commit:', index);
    console.time('commit');
    const coder = new Coder(
      await gateway.fetcher.fetchBytes(`/commit?index=${toUnpaddedHex(index)}`)
    );
    const proof: RPCEthGetProof = JSON.parse(
      toUtf8String(coder.readSizedBytes())
    );
    const block: RPCEthGetBlock = JSON.parse(
      toUtf8String(coder.readSizedBytes())
    );
    Object.assign(commitObj, {
      proof,
      block,
    });
    const trunk = coder.readNode();
    const limbs = new Map<string, MaybeNode>();
    const depth = coder.readSize();
    while (coder.pos < coder.buf.length) {
      limbs.set(toHex(coder.readBytes(depth)), coder.readNode());
    }
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
                const part = path.subarray(0, depth);
                let node = copyNode(trunk);
                const limb = limbs.get(toHex(part));
                if (limb) node = graftLimb(node, part, limb);
                const leaf = findLeaf(node, path);
                const word = new Uint8Array(32);
                if (leaf) word.set(leaf.data, 32 - leaf.data.length);
                return toHex(word);
              }
              case 'eth_getProof': {
                checkContext(params[0], params[2]);
                const slots = (params[1] as string[]).map((hexSlot, i) => {
                  const slot = toBytes(hexSlot, 32);
                  const path = toNibblePath(keccak256(slot));
                  const part = path.subarray(0, depth);
                  const partKey = toHex(part);
                  return { slot, path, part, partKey, i };
                });
                const buckets = new Map<string, typeof slots>();
                for (const x of slots) {
                  let bucket = buckets.get(x.partKey);
                  if (!bucket) {
                    bucket = [];
                    buckets.set(x.partKey, bucket);
                  }
                  bucket.push(x);
                }
                proof.storageProof = [];
                for (const [pathKey, bucket] of buckets) {
                  let node = copyNode(trunk);
                  const limb = limbs.get(pathKey);
                  if (limb) node = graftLimb(node, bucket[0].part, limb);
                  for (const x of bucket) {
                    const leaf = findLeaf(node, x.path);
                    proof.storageProof[x.i] = {
                      key: toHex(x.slot),
                      value: leaf?.data.length ? toHex(leaf.data) : '0x0',
                      proof: getProof(node, x.path).map((v) => toHex(v)),
                    };
                  }
                }
                return proof;
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
        const commits = gateway.commits.map((x) => ({
          index: toUnpaddedHex(x.index),
        }));
        return Response.json(
          { gateways: gateway.fetcher.urls, commits },
          { headers }
        );
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
