import { Foundry } from '@adraffy/blocksmith';
import { toPaddedHex } from '../src/utils.js';

const foundry = await Foundry.launch({ infoLog: false });

const report: Record<string, bigint> = {};
foundry.on('deploy', (c) => (report[c.__info.contract] = c.__receipt.gasUsed));

const A = toPaddedHex(1, 20);
const U = ['https://gateway.com'];

// machine
const GatewayVM = await foundry.deploy({ file: 'GatewayVM' });

// hooks
await foundry.deploy({ file: 'EthVerifierHooks' });
await foundry.deploy({ file: 'ScrollVerifierHooks', args: [A] });
await foundry.deploy({ file: 'ZKSyncVerifierHooks', args: [A] });
await foundry.deploy({
  file: 'LineaVerifierHooks',
  libs: { SparseMerkleProof: A },
});

// finders
await foundry.deploy({ file: 'OPFaultGameFinder' });
await foundry.deploy({ file: 'OPOutputFinder' });

// various verifiers
await foundry.deploy({
  file: 'NitroVerifier',
  args: [U, 1, A, A, 0],
  libs: { GatewayVM },
});
await foundry.deploy({
  file: 'DoubleNitroVerifier',
  args: [U, 1, A, A, 0, A, ['0x']],
  libs: { GatewayVM },
});
await foundry.deploy({
  file: 'OPVerifier',
  args: [U, 1, A, A, A, 0],
  libs: { GatewayVM },
});
await foundry.deploy({
  file: 'OPFaultVerifier',
  args: [U, 1, A, [A, A, 0, 0]],
  libs: { GatewayVM },
});
await foundry.deploy({
  file: 'ReverseOPVerifier',
  args: [U, 1, A, A],
  libs: { GatewayVM },
});
await foundry.deploy({
  file: 'LineaVerifier',
  args: [U, 1, A, A],
  libs: { GatewayVM },
});
await foundry.deploy({
  file: 'UnfinalizedLineaVerifier',
  args: [U, 1, A, A],
  libs: { GatewayVM },
});
await foundry.deploy({
  file: 'TaikoVerifier',
  args: [U, 1, A, A],
  libs: { GatewayVM },
});
await foundry.deploy({
  file: 'PolygonPoSVerifier',
  args: [U, 1, A, A, A],
  libs: { GatewayVM },
});
await foundry.deploy({
  file: 'ScrollVerifier',
  args: [U, 1, A, A],
  libs: { GatewayVM },
});
await foundry.deploy({
  file: 'ZKSyncVerifier',
  args: [U, 1, A, A],
  libs: { GatewayVM },
});
await foundry.deploy({
  file: 'SelfVerifier',
  args: [U, 1, A],
  libs: { GatewayVM },
});

// trusted
await foundry.deploy({
  file: 'TrustedVerifier',
  args: [A, U, [A], 1],
  libs: { GatewayVM },
});
const factory = await foundry.deploy({
  file: 'TrustedVerifierFactory',
  libs: { GatewayVM },
});
report.TrustedVerifierFactoryClone1 = (
  await foundry.confirm(factory.create(A, A, U, [A], 1))
).gasUsed;
report.TrustedVerifierFactoryClone2 = (
  await foundry.confirm(factory.create(A, A, U, [A], 1))
).gasUsed;

await foundry.shutdown();

console.log(new Date());
console.log(report);

// 2025-02-11T00:48:16.776Z
// {
//   GatewayVM: 1905202n,
//   EthVerifierHooks: 1309379n,
//   ScrollVerifierHooks: 564033n,
//   ZKSyncVerifierHooks: 323789n,
//   LineaVerifierHooks: 817863n,
//   OPFaultGameFinder: 607153n,
//   OPOutputFinder: 374675n,
//   NitroVerifier: 1775745n,
//   DoubleNitroVerifier: 1904504n,
//   OPVerifier: 1140773n,
//   OPFaultVerifier: 1291155n,
//   ReverseOPVerifier: 1530446n,
//   LineaVerifier: 994135n,
//   UnfinalizedLineaVerifier: 1002572n,
//   TaikoVerifier: 1062908n,
//   PolygonPoSVerifier: 1906201n,
//   ScrollVerifier: 994363n,
//   ZKSyncVerifier: 1108496n,
//   SelfVerifier: 1420183n,
//   TrustedVerifier: 1368494n,
//   TrustedVerifierFactory: 1520974n,
//   TrustedVerifierFactoryClone1: 167638n,
//   TrustedVerifierFactoryClone2: 211020n,
// }
