import { Foundry } from '@adraffy/blocksmith';
import { EthSelfRollup } from '../../../src/eth/EthSelfRollup.js';
import { Gateway } from '../../../src/gateway.js';
import { describe } from '../../bun-describe-fix.js';
import { afterAll, expect, test } from 'bun:test';
import { namehash } from 'ethers/hash';
import { serve } from '@namestone/ezccip/serve';
import { createProvider, providerURL } from '../../providers.js';
import { CHAINS } from '../../../src/chains.js';
import { GatewayProgram } from '../../../src/vm.js';
import { hexlify } from 'ethers/utils';

describe('PublicResolver', async () => {
  const foundry = await Foundry.launch({
    fork: providerURL(CHAINS.MAINNET),
    infoLog: true,
  });
  afterAll(foundry.shutdown);
  const rollup = new EthSelfRollup(createProvider(CHAINS.MAINNET));
  const gateway = new Gateway(rollup);
  const ccip = await serve(gateway, { protocol: 'raw', log: false });
  afterAll(ccip.shutdown);

  // setup verifier
  const GatewayVM = await foundry.deploy({ file: 'GatewayVM' });
  const hooks = await foundry.deploy({ file: 'EthVerifierHooks' });
  const verifier = await foundry.deploy({
    file: 'SelfVerifier',
    args: [[ccip.endpoint], rollup.defaultWindow, hooks],
    libs: { GatewayVM },
  });

  // create verified ENS contract
  const resolver = await foundry.deploy({
    file: 'VerifiedENS',
    args: [verifier],
  });

  // create program
  const publicResolverV3 = new GatewayProgram()
    .setSlot(0) // recordVersions
    .pushStack(0) // node
    .follow() // recordVersions[node]
    .read() // version, leave on stack at offset 1
    .setSlot(2) // addresses
    .follow() // slot
    .follow() // node
    .push(60) // coinType
    .follow() // addresses[version][node][coinType]
    .readBytes()
    .setOutput(1);
  console.log(hexlify(publicResolverV3.encode()));

  // await foundry.confirm(
  //   resolver.setResolverProgram(
  //     '0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63',
  //     publicResolverV3.encode()
  //   )
  // );

  // https://adraffy.github.io/ens-normalize.js/test/resolver.html#vitalik.eth
  test('vitalik.eth', async () => {
    expect(
      resolver.resolveWithProgram(
        namehash('vitalik.eth'),
        publicResolverV3.encode(),
        { enableCcipRead: true }
      )
    ).resolves.toStrictEqual([
      '0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63', // PublicResolverV3
      '0xd8da6bf26964af9d7eed9e03e53415d37aa96045', // vitalik.eth addr(60)
    ]);
  });
});
