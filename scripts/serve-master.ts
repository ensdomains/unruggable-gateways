import type { Serve } from 'bun';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  Contract,
  EventLog,
  Interface,
  JsonRpcProvider,
  isError,
} from 'ethers';
import { flattenErrors, toUnpaddedHex } from '../src/utils.js';
import { chainFromName, chainName, CHAINS } from '../src/chains.js';
import { isRollupDeployment } from '../src/rollup.js';
import { createProviderPair, RPC_INFO } from '../test/providers.js';
import { Gateway } from '../src/gateway.js';
import { OPFaultRollup } from '../src/op/OPFaultRollup.js';

const REGISTRAR = '0x0000000000D8e504002cC26E3Ec46D81971C1664';
const REGISTRAR_ABI = new Interface([
  `function owner() view returns (address)`,
  `event NameForAddrChanged(address indexed addr, string name)`,
]);

const args = parseArgs({
  options: {
    chain: {
      type: 'string',
      short: 'c',
    },
    port: {
      type: 'string',
      short: 'p',
      default: '8050',
    },
    commitDepth: {
      type: 'string',
      short: 'd',
      default: '1',
    },
  },
});

const port = parseInt(args.values.port);
console.log(`Port: ${port}`);

const commitDepth = parseInt(args.values.commitDepth);
if (!Number.isInteger(commitDepth) || commitDepth < 0 || commitDepth > 10) {
  throw new Error(`invalid commitDepth`);
}
console.log(`CommitDepth: ${commitDepth}`);

const chain = chainFromName(args.values.chain ?? '');
console.log(`Chain: ${chainName(chain)} (${chain})`);

const config = Object.values(OPFaultRollup).find(
  (x) => isRollupDeployment(x) && x.chain2 === chain
);
if (!config) throw new Error(`unknown OPFaultRollup`);

const [createdAtBlock, cacheName, ownable] = (() => {
  switch (chain) {
    case CHAINS.OP:
      return [137403854, 'optimism', false];
    case CHAINS.BASE:
      return [31808582, 'base', true];
    default:
      throw new Error(`unknown deployment block`);
  }
})();

const cacheFile = new URL(
  `../../merkle-builder/demo/${cacheName}.json`,
  import.meta.url
);
const NAMES: [number, string, string][] = [];

let block0 = createdAtBlock;
try {
  const json = JSON.parse(readFileSync(cacheFile, 'utf8')) as {
    block0: number;
    names: typeof NAMES;
  };
  block0 = json.block0;
  for (const x of json.names) NAMES.push(x);
  console.log(`Loaded: ${json.names.length}`);
} catch (err) {
  console.error(err);
  // ignored
}

function save() {
  writeFileSync(
    cacheFile,
    JSON.stringify({ block0, names: NAMES }, undefined, '\t')
  );
  console.log(`Saved: ${NAMES.length}`);
}

process.once('SIGINT', () => {
  console.log('\nStopping...');
  save();
  process.exit();
});

const rollup = new OPFaultRollup(createProviderPair(config), config, 21600);
const gateway = new Gateway(rollup);
gateway.commitDepth = commitDepth;
gateway.latestCache.cacheMs = 5 * 60000;

const prefetch = async () => {
  try {
    const t0 = Date.now();
    const [_, commits] = await Promise.all([
      syncLogs(),
      gateway.getRecentCommits(),
    ]);
    console.log(
      `Prefetch: ${commits.map((x) => x.index)} <${Date.now() - t0}ms>`
    );
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
        const url = new URL(req.url);
        if (url.pathname === '/') {
          return Response.json(
            {
              block: block0,
              commits: Array.from(
                gateway.commitCacheMap.cachedKeys(),
                toUnpaddedHex
              ),
            },
            { headers }
          );
        } else if (url.pathname === '/commit.json') {
          const index = BigInt(url.searchParams.get('index') ?? '');
          const cache = await gateway.commitCacheMap.cachedValue(index);
          if (!cache) throw new Error(`unknown commit: ${index}`);
          const { index: _, prover, game: __, ...commit } = cache.commit;
          const [block, proof, owner] = await Promise.all([
            prover.fetchBlock(),
            prover.fetchProofs(REGISTRAR),
            ownable ? prover.getStorage(REGISTRAR, 1n, true) : null,
          ]);
          return Response.json({ block, proof, owner, commit }, { headers });
        } else if (url.pathname === '/names.json') {
          const block = parseInt(url.searchParams.get('block') ?? '') || 0;
          const limit = parseInt(url.searchParams.get('limit') ?? '') || 1000;
          const start = NAMES.findIndex((x) => x[0] >= block);
          let end = start + limit;
          if (end < NAMES.length) {
            const lastBlock = NAMES[end - 1][0];
            while (end < NAMES.length && NAMES[end][0] === lastBlock) end++;
          }
          const nextBlock = end < NAMES.length ? NAMES[end][0] : block0;
          return Response.json({
            nextBlock,
            names: NAMES.slice(start, end),
          });
        } else {
          return new Response('file not found', { status: 404 });
        }
      }
      default: {
        return new Response('unsupported', { status: 405, headers });
      }
    }
  },
} satisfies Serve;

async function syncLogs() {
  const LOG_STEP = 10000;
  const info = RPC_INFO.get(chain);
  if (!info) throw new Error('bug');
  console.time('sync');
  const p = new JsonRpcProvider(info.publicHTTP, chain, {
    staticNetwork: true,
    batchMaxCount: 1,
  });
  let calls = 0;
  p.on('debug', (x) => {
    if (x.action === 'sendRpcPayload') calls++;
  });
  const registrar = new Contract(REGISTRAR, REGISTRAR_ABI, p);
  let lastSavedBlock = block0;
  while (true) {
    const t0 = Date.now();
    const block1 = await p.getBlockNumber();
    while (block0 < block1) {
      const { logs, lastBlock } = await getLogs(
        registrar,
        block0,
        Math.min(block1, block0 + LOG_STEP - 1)
      );
      for (const log of logs) {
        NAMES.push([log.blockNumber, log.args.addr, log.args.name]);
        console.log(`[${log.blockNumber}] ${log.args.addr} = ${log.args.name}`);
      }
      block0 = lastBlock + 1;
      if (logs.length) {
        save();
        lastSavedBlock = block0;
      }
    }
    if (Date.now() - t0 < 1000) break;
  }
  if (lastSavedBlock != block0) {
    save();
  }
  console.log(`Calls: ${calls}`);
  console.timeEnd('sync');
}

async function getLogs(
  registrar: Contract,
  block0: number,
  block1: number
): Promise<{ logs: EventLog[]; lastBlock: number }> {
  const event = registrar.filters.NameForAddrChanged();
  while (true) {
    const count = 1 + block1 - block0;
    try {
      const logs = await registrar.queryFilter(event, block0, block1);
      console.log(`getLogs: ${block0}-${block1} (${count}) = ${logs.length}`);
      if (logs.length > 100) {
        const lastBlock = logs[logs.length - 1].blockNumber;
        if (logs[0].blockNumber !== lastBlock) {
          block1 = lastBlock - 1; // rewind incase it was truncated (not sure this happens)
          const i = logs.findLastIndex((x) => x.blockNumber <= block1);
          logs.splice(i + 1, logs.length - i);
        }
      }
      return { logs: logs as EventLog[], lastBlock: block1 };
    } catch (err: unknown) {
      if (isError(err, 'UNKNOWN_ERROR')) {
        const match = err.message.match(
          // this error is thrown by drpc
          /^query exceeds max results (\d+), retry with the range (\d+)-(\d+)$/
        );
        if (match && parseInt(match[2]) === block0) {
          block1 = parseInt(match[3]);
          continue;
        }
      } else if (count > 1) {
        const half = count >> 1;
        console.log(`getLogs: ${count} => ${half} (retry)`);
        block1 = block0 + half - 1;
        continue;
      }
      throw err;
    }
  }
}
