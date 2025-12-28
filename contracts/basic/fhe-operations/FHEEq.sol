// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint8, ebool, externalEuint8 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHEEq
 * @notice Demonstrates FHE equality comparison on encrypted values.
 * @dev This example shows how to compare two encrypted values using FHE.eq()
 *      which returns an encrypted boolean (ebool).
 */
contract FHEEq is ZamaEthereumConfig {
  euint8 private _a;
  euint8 private _b;
  // solhint-disable-next-line var-name-mixedcase
  ebool private _a_equals_b;

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
   * @notice Compares two encrypted values for equality.
   * @dev FHE.eq() returns an encrypted boolean (ebool).
   *      The result reveals nothing about the comparison until decrypted.
   */
  function compareAEqualsB() external {
    // FHE equality comparison returns an encrypted boolean
    _a_equals_b = FHE.eq(_a, _b);

    // Grant permissions for the result
    FHE.allowThis(_a_equals_b);
    FHE.allow(_a_equals_b, msg.sender);
  }

  function result() public view returns (ebool) {
    return _a_equals_b;
  }
}
