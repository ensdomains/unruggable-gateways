import type { RollupDeployment } from '../rollup.js';
import type { HexAddress, ProviderPair } from '../types.js';
import { type ABIOutputTuple, ORACLE_ABI } from './types.js';
import { Contract } from 'ethers/contract';
import { CHAINS } from '../chains.js';
import { AbstractOPRollup, type OPCommit } from './AbstractOPRollup.js';

export type OPConfig = {
  L2OutputOracle: HexAddress; // sometimes called L2OutputOracleProxy
};

export class OPRollup extends AbstractOPRollup {
  // 20241030: base changed to fault proofs
  // static readonly baseMainnetConfig: RollupDeployment<OPConfig> = {
  //   chain1: CHAINS.MAINNET,
  //   chain2: CHAINS.BASE,
  //   L2OutputOracle: '0x56315b90c40730925ec5485cf004d835058518A0',
  // };

  // https://docs.blast.io/building/contracts#mainnet
  static readonly blastMainnnetConfig: RollupDeployment<OPConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.BLAST,
    L2OutputOracle: '0x826D1B0D4111Ad9146Eb8941D7Ca2B6a44215c76',
  };

  // https://docs.frax.com/fraxtal/addresses/fraxtal-contracts#mainnet
  static readonly fraxtalMainnetConfig: RollupDeployment<OPConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.FRAXTAL,
    L2OutputOracle: '0x66CC916Ed5C6C2FA97014f7D1cD141528Ae171e4',
  };

  // https://docs.zora.co/zora-network/network#zora-network-mainnet-1
  static readonly zoraMainnetConfig: RollupDeployment<OPConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.ZORA,
    L2OutputOracle: '0x9E6204F750cD866b299594e2aC9eA824E2e5f95c',
  };

  // https://docs-v2.mantle.xyz/intro/system-components/on-chain-system
  static readonly mantleMainnetConfig: RollupDeployment<OPConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.MANTLE,
    L2OutputOracle: '0x31d543e7BE1dA6eFDc2206Ef7822879045B9f481',
  };

  // https://docs.mode.network/general-info/mainnet-contract-addresses/l1-l2-contracts
  static readonly modeMainnetConfig: RollupDeployment<OPConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.MODE,
    L2OutputOracle: '0x4317ba146D4933D889518a3e5E11Fe7a53199b04',
  };

  // https://docs.cyber.co/build-on-cyber/addresses-mainnet
  // https://docs.cyber.co/build-on-cyber/addresses-testnet
  static readonly cyberMainnetConfig: RollupDeployment<OPConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.CYBER,
    L2OutputOracle: '0xa669A743b065828682eE16109273F5CFeF5e676d',
  };

  // https://redstone.xyz/docs/contract-addresses
  static readonly redstoneMainnetConfig: RollupDeployment<OPConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.REDSTONE,
    L2OutputOracle: '0xa426A052f657AEEefc298b3B5c35a470e4739d69',
  };

  // https://docs.shape.network/documentation/technical-details/contract-addresses#mainnet
  static readonly shapeMainnetConfig: RollupDeployment<OPConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.SHAPE,
    L2OutputOracle: '0x6Ef8c69CfE4635d866e3E02732068022c06e724D',
  };

  // https://docs.bnbchain.org/bnb-opbnb/core-concepts/opbnb-protocol-addresses/
  static readonly opBNBMainnetConfig: RollupDeployment<OPConfig> = {
    chain1: CHAINS.BSC,
    chain2: CHAINS.OP_BNB,
    L2OutputOracle: '0x153CAB79f4767E2ff862C94aa49573294B13D169',
  };

  // https://storage.googleapis.com/cel2-rollup-files/alfajores/deployment-l1.json
  static readonly celoAlfajoresConfig: RollupDeployment<OPConfig> = {
    chain1: CHAINS.HOLESKY,
    chain2: CHAINS.CELO_ALFAJORES,
    L2OutputOracle: '0x4a2635e9e4f6e45817b1D402ac4904c1d1752438',
  };

  // https://docs.worldcoin.org/world-chain/developers/world-chain-contracts
  static readonly worldMainnetConfig: RollupDeployment<OPConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.WORLD,
    L2OutputOracle: '0x19A6d1E9034596196295CF148509796978343c5D',
  };

  // https://docs.zircuit.com/smart-contracts/contract_addresses
  static readonly zircuitMainnetConfig: RollupDeployment<OPConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.ZIRCUIT,
    L2OutputOracle: '0x92Ef6Af472b39F1b363da45E35530c24619245A4',
  };
  // https://docs.zircuit.com/testnet/contract_addresses
  static readonly zircuitSepoliaConfig: RollupDeployment<OPConfig> = {
    chain1: CHAINS.SEPOLIA,
    chain2: CHAINS.ZIRCUIT_SEPOLIA,
    L2OutputOracle: '0x740C2dac453aEf7140809F80b72bf0e647af8148',
  };

  // https://docs.lisk.com/contracts#ethereum-network-l1
  static readonly liskMainnetConfig: RollupDeployment<OPConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.LISK,
    L2OutputOracle: '0x113cB99283AF242Da0A0C54347667edF531Aa7d6',
  };
  static readonly liskSepoliaConfig: RollupDeployment<OPConfig> = {
    chain1: CHAINS.SEPOLIA,
    chain2: CHAINS.LISK_SEPOLIA,
    L2OutputOracle: '0xA0E35F56C318DE1bD5D9ca6A94Fe7e37C5663348',
  };

  // https://docs.mintchain.io/deploy/contracts#l1-contract-addresses
  static readonly mintMainnetConfig: RollupDeployment<OPConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.MINT,
    L2OutputOracle: '0xB751A613f2Db932c6cdeF5048E6D2af05F9B98ED',
    //commitFreqSec: 12 * 60 * 60 // 12hr
  };
  static readonly mintSepoliaConfig: RollupDeployment<OPConfig> = {
    chain1: CHAINS.SEPOLIA,
    chain2: CHAINS.MINT_SEPOLIA,
    L2OutputOracle: '0x0Da5ac919E3C42E825b4dC221983Da6A0021DCdD',
  };

  // https://docs.gobob.xyz/learn/reference/contracts/#ethereum-l1
  static readonly bobMainnetConfig: RollupDeployment<OPConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.BOB,
    L2OutputOracle: '0xdDa53E23f8a32640b04D7256e651C1db98dB11C1',
    // commitFreqSec: 12hr
  };
  static readonly bobSepoliaConfig: RollupDeployment<OPConfig> = {
    chain1: CHAINS.SEPOLIA,
    chain2: CHAINS.BOB_SEPOLIA,
    L2OutputOracle: '0xd1cBBC06213B7E14e99aDFfFeF1C249E6f9537e0',
  };

  readonly L2OutputOracle;
  constructor(providers: ProviderPair, config: OPConfig) {
    super(providers);
    this.L2OutputOracle = new Contract(
      config.L2OutputOracle,
      ORACLE_ABI,
      providers.provider1
    );
  }

  override async fetchLatestCommitIndex(): Promise<bigint> {
    return this.L2OutputOracle.latestOutputIndex({
      blockTag: this.latestBlockTag,
    });
  }
  protected override async _fetchParentCommitIndex(
    commit: OPCommit
  ): Promise<bigint> {
    return commit.index - 1n;
  }
  protected override async _fetchCommit(index: bigint) {
    // this fails with ARRAY_RANGE_ERROR when invalid
    const output: ABIOutputTuple = await this.L2OutputOracle.getL2Output(index);
    return this.createCommit(index, output.l2BlockNumber);
  }

  override windowFromSec(sec: number): number {
    // finalization time is on-chain
    // https://github.com/ethereum-optimism/optimism/blob/a81de910dc2fd9b2f67ee946466f2de70d62611a/packages/contracts-bedrock/src/L1/L2OutputOracle.sol#L231
    return sec;
  }
}
