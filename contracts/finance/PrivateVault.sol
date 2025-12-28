// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint64, externalEuint64 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title PrivateVault
 * @notice A vault where deposit/withdraw amounts and balances remain encrypted.
 * @dev Demonstrates privacy-preserving financial operations using FHE.
 *
 *      Key Features:
 *      - Encrypted balance tracking per user
 *      - Encrypted deposit amounts
 *      - Encrypted withdrawal with balance verification
 *      - Only user can decrypt their own balance
 */
contract PrivateVault is ZamaEthereumConfig {
  // Mapping from user address to encrypted balance
  mapping(address => euint64) private _balances;

  event Deposited(address indexed user);
  event Withdrawn(address indexed user);

  // solhint-disable-next-line no-empty-blocks
  constructor() {}

  /**
   * @notice Deposit encrypted amount into vault.
   * @param encryptedAmount Encrypted amount to deposit
   * @param inputProof Proof for the encrypted input
   */
  function deposit(externalEuint64 encryptedAmount, bytes calldata inputProof) external {
    euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
    FHE.allowThis(amount);

    // Add to existing balance (or initialize if first deposit)
    euint64 currentBalance = _balances[msg.sender];
    euint64 newBalance = FHE.add(currentBalance, amount);

    FHE.allowThis(newBalance);
    _balances[msg.sender] = newBalance;

    emit Deposited(msg.sender);
  }

  /**
   * @notice Withdraw encrypted amount from vault.
   * @dev Uses FHE.select to ensure withdrawal only happens if balance is sufficient.
   * @param encryptedAmount Encrypted amount to withdraw
   * @param inputProof Proof for the encrypted input
   */
  function withdraw(externalEuint64 encryptedAmount, bytes calldata inputProof) external {
    euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
    FHE.allowThis(amount);

    euint64 currentBalance = _balances[msg.sender];

    // Check if balance >= amount (encrypted comparison)
    // If sufficient: newBalance = currentBalance - amount
    // If insufficient: newBalance = currentBalance (no change)
    euint64 zero = FHE.asEuint64(0);
    euint64 potentialNewBalance = FHE.sub(currentBalance, amount);

    // Select new balance based on whether we have enough funds
    // FHE.ge returns ebool, FHE.select chooses based on condition
    euint64 newBalance = FHE.select(
      FHE.ge(currentBalance, amount),
      potentialNewBalance,
      currentBalance
    );

    FHE.allowThis(newBalance);
    _balances[msg.sender] = newBalance;

    emit Withdrawn(msg.sender);
  }

  /**
   * @notice Get encrypted balance for caller.
   * @dev Grants permission to caller to decrypt their balance.
   * @return Encrypted balance
   */
  function getBalance() external returns (euint64) {
    euint64 balance = _balances[msg.sender];
    FHE.allow(balance, msg.sender);
    return balance;
  }

  /**
   * @notice View function to get balance handle (without permission).
   * @dev Returns handle but caller cannot decrypt without calling getBalance() first.
   * @return Encrypted balance handle
   */
  function viewBalance() external view returns (euint64) {
    return _balances[msg.sender];
  }
}
