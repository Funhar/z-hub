// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint8, externalEuint8 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title AccessControl
 * @notice Demonstrates FHE access control mechanisms: allow and allowTransient.
 * @dev This example shows the difference between:
 *      - FHE.allow(): Grants permanent permission to an address
 *      - FHE.allowTransient(): Grants ephemeral permission for the current tx only
 *      - FHE.allowThis(): Shortcut for allowing the contract itself
 */
contract AccessControl is ZamaEthereumConfig {
  euint8 private _secretValue;

  // Mapping to track who has been granted permanent access
  mapping(address => bool) public hasPermanentAccess;

  event PermanentAccessGranted(address indexed user);
  event TransientAccessGranted(address indexed user);

  // solhint-disable-next-line no-empty-blocks
  constructor() {}

  /**
   * @notice Store an encrypted value with contract-only access.
   * @dev Only FHE.allowThis() is called, so only the contract can operate on it.
   */
  function storeSecret(externalEuint8 input, bytes calldata inputProof) external {
    _secretValue = FHE.fromExternal(input, inputProof);
    // Only the contract itself can access this value
    FHE.allowThis(_secretValue);
  }

  /**
   * @notice Grant permanent FHE permission to a user.
   * @dev FHE.allow() grants persistent permission that survives across transactions.
   *      The user can decrypt the value at any time after this call.
   */
  function grantPermanentAccess(address user) external {
    // Grant permanent access to the user
    FHE.allow(_secretValue, user);
    hasPermanentAccess[user] = true;
    emit PermanentAccessGranted(user);
  }

  /**
   * @notice Grant temporary FHE permission for this transaction only.
   * @dev FHE.allowTransient() grants ephemeral permission that is revoked when tx ends.
   *      Useful for intermediate computations where values shouldn't persist.
   */
  function grantTransientAccess(address user) external {
    // Grant transient access - permission expires when transaction ends
    FHE.allowTransient(_secretValue, user);
    emit TransientAccessGranted(user);
  }

  /**
   * @notice Get the secret value handle (for decryption by authorized users).
   */
  function getSecret() public view returns (euint8) {
    return _secretValue;
  }

  /**
   * @notice Demonstrates chained operations with allowThis.
   * @dev After any FHE operation, the result only has transient permission.
   *      You must call FHE.allowThis() to persist the contract's access.
   */
  function doubleSecret() external {
    // Add the secret to itself
    euint8 doubled = FHE.add(_secretValue, _secretValue);

    // Without this, the contract loses access after the tx ends
    FHE.allowThis(doubled);

    // Update the stored value
    _secretValue = doubled;
  }
}
