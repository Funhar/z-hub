// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint8, externalEuint8 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHESub
 * @notice Demonstrates FHE subtraction operation on encrypted values.
 * @dev This example shows how to perform subtraction using FHE.sub()
 *      while maintaining proper FHE permissions for the result.
 */
contract FHESub is ZamaEthereumConfig {
  euint8 private _a;
  euint8 private _b;
  // solhint-disable-next-line var-name-mixedcase
  euint8 private _a_minus_b;

  // solhint-disable-next-line no-empty-blocks
  constructor() {}

  function setA(externalEuint8 inputA, bytes calldata inputProof) external {
    _a = FHE.fromExternal(inputA, inputProof);
    FHE.allowThis(_a);
  }

  function setB(externalEuint8 inputB, bytes calldata inputProof) external {
    _b = FHE.fromExternal(inputB, inputProof);
    FHE.allowThis(_b);
  }

  /**
   * @notice Computes the subtraction of two encrypted values (a - b).
   * @dev The contract must have FHE permissions over both operands.
   *      After computation, permissions are granted to both the contract
   *      and the caller for decryption.
   *      Note: If b > a, the result will underflow (wrap around) due to
   *      unsigned integer arithmetic.
   */
  function computeAMinusB() external {
    // Perform FHE subtraction - the contract needs permission on both values
    _a_minus_b = FHE.sub(_a, _b);

    // Grant permanent FHE permissions for the result
    FHE.allowThis(_a_minus_b);
    FHE.allow(_a_minus_b, msg.sender);
  }

  function result() public view returns (euint8) {
    return _a_minus_b;
  }
}
