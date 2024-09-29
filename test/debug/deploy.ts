import { Foundry } from '@adraffy/blocksmith';
import { ZeroAddress } from 'ethers/constants';

const foundry = await Foundry.launch({
  infoLog: true,
});

await foundry.deploy({
  sol: `
    import "@src/GatewayProver.sol";
    contract Prover {
      function f() external returns (bytes[] memory, uint8) {
        GatewayRequest memory r;
        ProofSequence memory s;
        return GatewayProver.evalRequest(r, s);
      }
    }
  `,
});
await foundry.deploy({
  file: 'EthSelfVerifier',
});
await foundry.deploy({
  file: 'OPVerifier',
});
await foundry.deploy({
  file: 'OPFaultVerifier',
  args: [ZeroAddress],
});
await foundry.deploy({
  file: 'OPReverseVerifier',
});
await foundry.deploy({
  file: 'LineaVerifier',
  libs: { SparseMerkleProof: ZeroAddress },
});
await foundry.deploy({
  file: 'NitroVerifier',
});
await foundry.deploy({
  file: 'ScrollVerifier',
});
await foundry.deploy({
  file: 'TaikoVerifier',
});
await foundry.deploy({
  file: 'ZKSyncVerifier',
  args: [ZeroAddress]
});

foundry.shutdown();
