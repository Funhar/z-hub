// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint8, euint16, externalEuint8 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title HandleLifecycle
 * @notice Demonstrates the lifecycle of FHE handles in FHEVM.
 * @dev Handles are unique identifiers for encrypted values. Understanding
 *      their lifecycle is crucial for proper FHEVM development:
 *
 *      1. CREATION: Handles are created when:
 *         - User submits encrypted input (externalEuint -> euint)
 *         - FHE operations produce new encrypted values
 *         - FHE.asEuintXX() trivial encryption
 *
 *      2. PERMISSIONS: Each handle has associated permissions:
 *         - Ephemeral: Temporary within transaction
 *         - Persistent: Stored and survives across transactions
 *
 *      3. SYMBOLIC EXECUTION: The blockchain doesn't see actual values,
 *         only operates on handles. Real computation happens off-chain.
 */
contract HandleLifecycle is ZamaEthereumConfig {
  // Different handle types for demonstration
  euint8 private _handle8;
  euint16 private _handle16;
  euint8 private _derivedHandle;

  // Track handle creation for educational purposes
  uint256 public handleCreationCount;

  event HandleCreated(string message);
  event HandleDerived(string operation);

  // solhint-disable-next-line no-empty-blocks
  constructor() {}

  /**
   * @notice Create a handle from user input (external handle).
   * @dev This is the most common way to create handles.
   *      The external handle from client-side encryption is converted
   *      to an internal handle that the contract can work with.
   */
  function createFromInput(externalEuint8 input, bytes calldata inputProof) external {
    _handle8 = FHE.fromExternal(input, inputProof);
    FHE.allowThis(_handle8);
    FHE.allow(_handle8, msg.sender);

    handleCreationCount++;
    emit HandleCreated("Handle created from user input");
  }

  /**
   * @notice Create a handle through trivial encryption.
   * @dev FHE.asEuintXX() encrypts a plaintext value on-chain.
   *      Note: This reveals the value publicly on-chain, so only use
   *      for public constants that need to interact with encrypted values.
   */
  function createFromTrivialEncryption(uint8 publicValue) external {
    // Trivial encryption - value is public but can interact with encrypted values
    _handle8 = FHE.asEuint8(publicValue);
    FHE.allowThis(_handle8);

    handleCreationCount++;
    emit HandleCreated("Handle created via trivial encryption");
  }

  /**
   * @notice Derive a new handle from existing handles.
   * @dev Any FHE operation creates a new derived handle.
   *      The derived handle initially has ephemeral permission only.
   */
  function deriveNewHandle() external {
    // Each operation creates a new handle
    _derivedHandle = FHE.add(_handle8, FHE.asEuint8(1));

    // Derived handles need explicit permission grants
    FHE.allowThis(_derivedHandle);
    FHE.allow(_derivedHandle, msg.sender);

    handleCreationCount++;
    emit HandleDerived("add");
  }

  /**
   * @notice Cast handle to different type (euint8 -> euint16).
   * @dev Type casting creates a new handle of the target type.
   */
  function castHandle() external {
    // Casting creates a new handle of different type
    _handle16 = FHE.asEuint16(_handle8);
    FHE.allowThis(_handle16);
    FHE.allow(_handle16, msg.sender);

    handleCreationCount++;
    emit HandleDerived("cast to euint16");
  }

  function getHandle8() public view returns (euint8) {
    return _handle8;
  }

  function getHandle16() public view returns (euint16) {
    return _handle16;
  }

  function getDerivedHandle() public view returns (euint8) {
    return _derivedHandle;
  }
}
