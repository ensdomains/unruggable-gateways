// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import '../../../contracts/GatewayFetchTarget.sol';
import '../../../contracts/GatewayFetcher.sol';

contract VerifiedENS is GatewayFetchTarget {
    using GatewayFetcher for GatewayRequest;

    address constant ENS_REGISTRY = 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e;
    address constant PUBLIC_RESOLVER_V3 =
        0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63;

    IGatewayVerifier immutable verifier;
    mapping(address resolver => bytes program) programs;

    constructor(IGatewayVerifier _verifier) {
        verifier = _verifier;
    }



    function resolveWithProgram(
        bytes32 node,
		bytes calldata program
    ) external view returns (address, bytes memory) {
        GatewayRequest memory req = GatewayFetcher.newRequest(2);
        req.push(node); // put node at stack(0)
        req.setTarget(ENS_REGISTRY); // target registry
        req.dup().follow().offset(1).read().setOutput(0); // read resolver and save it
		req.pushOutput(0).target(); // target resolver
		req.push(program); // load program
		req.eval(); // call it
        fetch(verifier, req, this.resolveCallback.selector);
    }
    
	// function setResolverProgram(
    //     address resolver,
    //     bytes calldata program
    // ) external {
    //     programs[resolver] = program;
    // }

    // function resolve(
    //     bytes32 node
    // ) external view returns (address, bytes memory) {
    //     GatewayRequest memory req = GatewayFetcher.newRequest(2);

    //     req.push(node);

    //     // get resolver
    //     req.setTarget(ENS_REGISTRY);
    //     req.dup().follow().offset(1).read().setOutput(0);

    //     // read program
    //     req.setTarget(address(this));
    //     req.pushOutput(0).follow().readBytes();
    //     req.eval();

    //     fetch(verifier, req, this.resolveCallback.selector);
    // }

    function resolveCallback(
        bytes[] calldata values,
        uint8,
        bytes calldata
    ) external pure returns (address resolver, bytes memory answer) {
        resolver = address(uint160(uint256(bytes32(values[0]))));
        answer = values[1];
    }
}
