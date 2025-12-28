Documentation for PrivateVault

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="PrivateVault.sol" %}

```solidity
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

```

{% endtab %}

{% tab title="PrivateVault.ts" %}

```typescript
import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { PrivateVault, PrivateVault__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "PrivateVault"
  )) as PrivateVault__factory;
  const vault = (await factory.deploy()) as PrivateVault;
  const vault_address = await vault.getAddress();

  return { vault, vault_address };
}

/**
 * Tests for PrivateVault - encrypted deposits and withdrawals
 */
describe("PrivateVault", function () {
  let contract: PrivateVault;
  let contractAddress: string;
  let signers: Signers;

  before(async function () {
    if (!hre.fhevm.isMock) {
      throw new Error(`This hardhat test suite cannot run on Sepolia Testnet`);
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { owner: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    const deployment = await deployFixture();
    contractAddress = deployment.vault_address;
    contract = deployment.vault;
  });

  describe("Deposit", function () {
    it("should deposit encrypted amount and update balance", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
      const depositAmount = 1000;

      // Create encrypted deposit
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(depositAmount)
        .encrypt();

      // Deposit
      let tx = await contract
        .connect(signers.alice)
        .deposit(input.handles[0], input.inputProof);
      await tx.wait();

      // Get balance
      tx = await contract.connect(signers.alice).getBalance();
      await tx.wait();

      const encryptedBalance = await contract
        .connect(signers.alice)
        .viewBalance();
      const balance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        contractAddress,
        signers.alice
      );

      expect(balance).to.equal(depositAmount);
    });

    it("should accumulate multiple deposits", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // First deposit: 500
      let input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(500)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .deposit(input.handles[0], input.inputProof);
      await tx.wait();

      // Second deposit: 300
      input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(300)
        .encrypt();
      tx = await contract
        .connect(signers.alice)
        .deposit(input.handles[0], input.inputProof);
      await tx.wait();

      // Get balance
      tx = await contract.connect(signers.alice).getBalance();
      await tx.wait();

      const encryptedBalance = await contract
        .connect(signers.alice)
        .viewBalance();
      const balance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        contractAddress,
        signers.alice
      );

      expect(balance).to.equal(800); // 500 + 300
    });
  });

  describe("Withdraw", function () {
    it("should withdraw when balance is sufficient", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Deposit 1000
      let input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(1000)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .deposit(input.handles[0], input.inputProof);
      await tx.wait();

      // Withdraw 400
      input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(400)
        .encrypt();
      tx = await contract
        .connect(signers.alice)
        .withdraw(input.handles[0], input.inputProof);
      await tx.wait();

      // Get balance
      tx = await contract.connect(signers.alice).getBalance();
      await tx.wait();

      const encryptedBalance = await contract
        .connect(signers.alice)
        .viewBalance();
      const balance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        contractAddress,
        signers.alice
      );

      expect(balance).to.equal(600); // 1000 - 400
    });

    it("should not change balance when withdrawal exceeds balance", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Deposit 500
      let input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(500)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .deposit(input.handles[0], input.inputProof);
      await tx.wait();

      // Try to withdraw 1000 (more than balance)
      input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(1000)
        .encrypt();
      tx = await contract
        .connect(signers.alice)
        .withdraw(input.handles[0], input.inputProof);
      await tx.wait();

      // Get balance - should still be 500
      tx = await contract.connect(signers.alice).getBalance();
      await tx.wait();

      const encryptedBalance = await contract
        .connect(signers.alice)
        .viewBalance();
      const balance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedBalance,
        contractAddress,
        signers.alice
      );

      expect(balance).to.equal(500); // Unchanged
    });
  });

  describe("Balance Privacy", function () {
    it("should keep balances separate per user", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Alice deposits 1000
      let input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(1000)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .deposit(input.handles[0], input.inputProof);
      await tx.wait();

      // Owner deposits 2000
      input = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add64(2000)
        .encrypt();
      tx = await contract
        .connect(signers.owner)
        .deposit(input.handles[0], input.inputProof);
      await tx.wait();

      // Check Alice's balance
      tx = await contract.connect(signers.alice).getBalance();
      await tx.wait();
      const aliceBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await contract.connect(signers.alice).viewBalance(),
        contractAddress,
        signers.alice
      );

      // Check Owner's balance
      tx = await contract.connect(signers.owner).getBalance();
      await tx.wait();
      const ownerBalance = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await contract.connect(signers.owner).viewBalance(),
        contractAddress,
        signers.owner
      );

      expect(aliceBalance).to.equal(1000);
      expect(ownerBalance).to.equal(2000);
    });
  });
});

```

{% endtab %}

{% endtabs %}
