import type { RollupDeployment } from '../rollup.js';
import type { HexAddress, HexString32, ProviderPair } from '../types.js';
import { Contract } from 'ethers/contract';
import { Interface } from 'ethers/abi';
import { CHAINS } from '../chains.js';
import { isEthersError } from '../utils.js';
import {
  AbstractOPRollup,
  hashOutputRootProof,
  type AbstractOPCommit,
} from './AbstractOPRollup.js';

// https://docs.optimism.io/chain/differences
// https://specs.optimism.io/fault-proof/stage-one/bridge-integration.html

export const PORTAL_ABI = new Interface([
  `function disputeGameFactory() view returns (address)`,
  `function respectedGameType() view returns (uint32)`,
  `function disputeGameBlacklist(address game) view returns (bool)`,
]);

export const GAME_FINDER_ABI = new Interface([
  `error GameNotFound()`,
  `error InvalidGameTypeBitMask()`,
  `function findGameIndex(address portal, uint256 minAge, uint256 gameTypeBitMask, uint256 gameCount) view returns (uint256)`,
  `function gameAtIndex(address portal, uint256 minAge, uint256 gameTypeBitMask, uint256 gameIndex) view returns (
	 uint256 gameType, uint256 created, address gameProxy, uint256 l2BlockNumber, bytes32 rootClaim
   )`,
]);

export const GAME_ABI = new Interface([
  `function rootClaim() view returns (bytes32)`,
]);

export type OPFaultConfig = {
  OptimismPortal: HexAddress;
  GameFinder: HexAddress;
};

export type OPFaultCommit = AbstractOPCommit & { game: ABIFoundGame };

type ABIFoundGame = {
  gameType: bigint;
  created: bigint;
  gameProxy: HexAddress;
  l2BlockNumber: bigint;
  rootClaim: string;
};

const GAME_FINDER_MAINNET = '0x728f1ac59A01d07bE3E62940eC9B3F5EF025C38b';
const GAME_FINDER_SEPOLIA = '0x165386f8699ce2609a8903e25d00e1debd24a277';

export class OPFaultRollup extends AbstractOPRollup<OPFaultCommit> {
  // https://docs.optimism.io/chain/addresses
  static readonly mainnetConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.OP,
    OptimismPortal: '0xbEb5Fc579115071764c7423A4f12eDde41f106Ed',
    GameFinder: GAME_FINDER_MAINNET,
  };
  static readonly sepoliaConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.SEPOLIA,
    chain2: CHAINS.OP_SEPOLIA,
    OptimismPortal: '0x16Fc5058F25648194471939df75CF27A2fdC48BC',
    GameFinder: GAME_FINDER_SEPOLIA,
  };

  // https://docs.base.org/docs/base-contracts#l1-contract-addresses
  static readonly baseMainnetConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.BASE,
    OptimismPortal: '0x49048044D57e1C92A77f79988d21Fa8fAF74E97e',
    GameFinder: GAME_FINDER_MAINNET,
  };
  // https://docs.base.org/docs/base-contracts/#ethereum-testnet-sepolia
  static readonly baseSepoliaConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.SEPOLIA,
    chain2: CHAINS.BASE_SEPOLIA,
    OptimismPortal: '0x49f53e41452C74589E85cA1677426Ba426459e85',
    GameFinder: GAME_FINDER_SEPOLIA,
  };

  // https://docs.inkonchain.com/useful-information/contracts#l1-contract-addresses
  static readonly inkMainnetConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.INK,
    OptimismPortal: '0x5d66c1782664115999c47c9fa5cd031f495d3e4f',
    GameFinder: GAME_FINDER_MAINNET,
  };
  static readonly inkSepoliaConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.SEPOLIA,
    chain2: CHAINS.INK_SEPOLIA,
    OptimismPortal: '0x5c1d29C6c9C8b0800692acC95D700bcb4966A1d7',
    GameFinder: GAME_FINDER_SEPOLIA,
  };

  // https://docs.unichain.org/docs/technical-information/contract-addresses
  static readonly unichainMainnetConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.UNICHAIN,
    OptimismPortal: '0x0bd48f6B86a26D3a217d0Fa6FfE2B491B956A7a2',
    GameFinder: GAME_FINDER_MAINNET,
  };
  static readonly unichainSepoliaConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.SEPOLIA,
    chain2: CHAINS.UNICHAIN_SEPOLIA,
    OptimismPortal: '0x0d83dab629f0e0F9d36c0Cbc89B69a489f0751bD',
    GameFinder: GAME_FINDER_SEPOLIA,
  };

  // https://docs.soneium.org/docs/builders/contracts
  static readonly soneiumMainnetConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.SONEIUM,
    OptimismPortal: '0x88e529a6ccd302c948689cd5156c83d4614fae92',
    GameFinder: GAME_FINDER_MAINNET,
  };
  static readonly soneiumMinatoConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.SEPOLIA,
    chain2: CHAINS.SONEIUM_SEPOLIA,
    OptimismPortal: '0x65ea1489741A5D72fFdD8e6485B216bBdcC15Af3',
    GameFinder: GAME_FINDER_SEPOLIA,
  };

  // https://build.swellnetwork.io/docs/developer-resources/contract-addresses
  static readonly swellMainnetConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.SWELL,
    OptimismPortal: '0x758E0EE66102816F5C3Ec9ECc1188860fbb87812',
    GameFinder: GAME_FINDER_MAINNET,
  };
  static readonly swellSepoliaConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.SEPOLIA,
    chain2: CHAINS.SWELL_SEPOLIA,
    OptimismPortal: '0x595329c60c0b9e54a5246e98fb0fa7fcfd454f64',
    GameFinder: GAME_FINDER_SEPOLIA,
  };

  // https://docs.worldcoin.org/world-chain/developers/world-chain-contracts
  static readonly worldMainnetConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.WORLD,
    OptimismPortal: '0xd5ec14a83B7d95BE1E2Ac12523e2dEE12Cbeea6C',
    GameFinder: GAME_FINDER_MAINNET,
  };

  // https://storage.googleapis.com/cel2-rollup-files/celo/deployment-l1.json
  static readonly celoMainnetConfig: RollupDeployment<OPFaultConfig> = {
    chain1: CHAINS.MAINNET,
    chain2: CHAINS.CELO,
    OptimismPortal: '0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC',
    GameFinder: GAME_FINDER_MAINNET,
  };

  // 20240917: delayed constructor not needed
  readonly OptimismPortal: Contract;
  readonly GameFinder: Contract;
  gameTypes: number[] = []; // if empty, dynamically uses respectedGameType()
  constructor(
    providers: ProviderPair,
    config: OPFaultConfig,
    public minAgeSec = 0
  ) {
    super(providers);
    this.OptimismPortal = new Contract(
      config.OptimismPortal,
      PORTAL_ABI,
      providers.provider1
    );
    this.GameFinder = new Contract(
      config.GameFinder,
      GAME_FINDER_ABI,
      providers.provider1
    );
  }

  get gameTypeBitMask() {
    return this.gameTypes.reduce((a, x) => a | (1 << x), 0);
  }

  override get unfinalized() {
    return !!this.minAgeSec; // nonzero => unfinalized
  }

  async fetchRespectedGameType(): Promise<bigint> {
    return this.OptimismPortal.respectedGameType({
      blockTag: this.latestBlockTag,
    });
  }
  private async _ensureRootClaim(index: bigint) {
    // dodge canary by requiring a valid root claim
    // finalized claims are assumed valid
    if (this.unfinalized) {
      for (;;) {
        try {
          await this.fetchCommit(index);
          break;
        } catch (err) {
          // NOTE: this could fail for a variety of reasons
          // so we can't just catch "invalid root claim"
          // canary often has invalid block <== likely triggers first
          // canary has invalid time
          // canary has invalid root claim
          if (isEthersError(err)) throw err;
          index = await this.GameFinder.findGameIndex(
            this.OptimismPortal.target,
            this.minAgeSec,
            this.gameTypeBitMask,
            index
          );
        }
      }
    }
    return index;
  }
  override async fetchLatestCommitIndex(): Promise<bigint> {
    // the primary assumption is that the anchor root is the finalized state
    // however, this is strangely conditional on the gameType
    // (apparently because the anchor state registry is *not* intended for finalization)
    // after a gameType switch, the finalized state "rewinds" to the latest game of the new type
    // to solve this, we use the latest finalized game of *any* supported gameType
    // 20240820: correctly handles the aug 16 respectedGameType change
    // this should be simplified in the future once there is a better policy
    // 20240822: once again uses a helper contract to reduce rpc burden
    return this._ensureRootClaim(
      await this.GameFinder.findGameIndex(
        this.OptimismPortal.target,
        this.minAgeSec,
        this.gameTypeBitMask,
        0, // most recent game
        { blockTag: this.latestBlockTag }
      )
    );
  }
  protected override async _fetchParentCommitIndex(
    commit: OPFaultCommit
  ): Promise<bigint> {
    return this._ensureRootClaim(
      await this.GameFinder.findGameIndex(
        this.OptimismPortal.target,
        this.minAgeSec,
        this.gameTypeBitMask,
        commit.index
      )
    );
  }
  protected override async _fetchCommit(index: bigint) {
    // note: GameFinder checks isCommitStillValid()
    const game: ABIFoundGame = await this.GameFinder.gameAtIndex(
      this.OptimismPortal.target,
      this.minAgeSec,
      this.gameTypeBitMask,
      index
    );
    if (!game.l2BlockNumber) throw new Error('invalid game');
    const commit = await this.createCommit(index, game.l2BlockNumber);
    if (this.unfinalized) {
      const gameProxy = new Contract(game.gameProxy, GAME_ABI, this.provider1);
      const expected: HexString32 = await gameProxy.rootClaim();
      const computed = hashOutputRootProof(commit);
      if (expected !== computed) throw new Error(`invalid root claim`);
    }
    return { ...commit, game };
  }
  override async isCommitStillValid(commit: OPFaultCommit): Promise<boolean> {
    return !(await this.OptimismPortal.disputeGameBlacklist(
      commit.game.gameProxy
    ));
  }

  override windowFromSec(sec: number): number {
    // finalization time is on-chain
    // https://github.com/ethereum-optimism/optimism/blob/a81de910dc2fd9b2f67ee946466f2de70d62611a/packages/contracts-bedrock/src/dispute/FaultDisputeGame.sol#L590
    return sec;
  }
}
