Reward creators or contributors anonymously with hidden tip amounts. Enables users to send support without revealing values, maintaining financial privacy for all parties.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="SecretTip.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint64, externalEuint64 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title SecretTip
 * @notice Anonymous tipping where sender and amount remain hidden.
 * @dev Demonstrates privacy-preserving donations using FHE.
 *
 *      Key Features:
 *      - Encrypted tip amounts
 *      - Sender identity not linked to tip amount
 *      - Running encrypted sum of tips
 *      - Only owner can decrypt total
 */
contract SecretTip is ZamaEthereumConfig {
  address public owner;
  euint64 private _totalTips;
  uint256 public tipCount;

  event TipReceived(uint256 indexed tipNumber);
  event TipsWithdrawn(uint256 timestamp);

  /**
   * @notice Initialize contract with owner
   */
  constructor() {
    owner = msg.sender;
    _totalTips = FHE.asEuint64(0);
    FHE.allowThis(_totalTips);
  }

  /**
   * @notice Send anonymous tip
   * @dev Tip amount is encrypted, sender is not stored
   * @param encryptedAmount Encrypted tip amount
   * @param inputProof Proof for the encrypted input
   */
  function tip(externalEuint64 encryptedAmount, bytes calldata inputProof) external {
    euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
    FHE.allowThis(amount);

    // Add to running total
    _totalTips = FHE.add(_totalTips, amount);
    FHE.allowThis(_totalTips);

    tipCount++;
    emit TipReceived(tipCount);
  }

  /**
   * @notice Get encrypted total tips (owner only)
   * @return Encrypted total tips
   */
  function getTotalTips() external returns (euint64) {
    require(msg.sender == owner, "Only owner can view total");

    FHE.allow(_totalTips, owner);
    return _totalTips;
  }

  /**
   * @notice View total tips handle (without permission)
   */
  function viewTotalTips() external view returns (euint64) {
    return _totalTips;
  }

  /**
   * @notice Reset tips counter (owner only)
   * @dev Used after withdrawal to start fresh
   */
  function resetTips() external {
    require(msg.sender == owner, "Only owner");

    _totalTips = FHE.asEuint64(0);
    FHE.allowThis(_totalTips);
    tipCount = 0;

    emit TipsWithdrawn(block.timestamp);
  }

  /**
   * @notice Get public tip count
   * @return Number of tips received
   */
  function getTipCount() external view returns (uint256) {
    return tipCount;
  }
}

```

{% endtab %}

{% tab title="SecretTip.ts" %}

```typescript
import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { SecretTip, SecretTip__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "SecretTip"
  )) as SecretTip__factory;
  const secretTip = (await factory.deploy()) as SecretTip;
  const secretTip_address = await secretTip.getAddress();

  return { secretTip, secretTip_address };
}

/**
 * Tests for SecretTip - anonymous tipping system
 */
describe("SecretTip", function () {
  let contract: SecretTip;
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
    contractAddress = deployment.secretTip_address;
    contract = deployment.secretTip;
  });

  describe("Tipping", function () {
    it("should accept encrypted tip", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(100)
        .encrypt();

      await expect(
        contract.connect(signers.alice).tip(input.handles[0], input.inputProof)
      ).to.emit(contract, "TipReceived");

      expect(await contract.getTipCount()).to.equal(1);
    });

    it("should accumulate multiple tips", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Tip 1: 100
      let input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(100)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .tip(input.handles[0], input.inputProof);
      await tx.wait();

      // Tip 2: 200
      input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(200)
        .encrypt();
      tx = await contract
        .connect(signers.alice)
        .tip(input.handles[0], input.inputProof);
      await tx.wait();

      expect(await contract.getTipCount()).to.equal(2);

      // Check total
      tx = await contract.connect(signers.owner).getTotalTips();
      await tx.wait();

      const total = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await contract.viewTotalTips(),
        contractAddress,
        signers.owner
      );

      expect(total).to.equal(300);
    });

    it("should accept tips from different senders", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Alice tips 50
      let input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(50)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .tip(input.handles[0], input.inputProof);
      await tx.wait();

      // Owner tips 75
      input = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add64(75)
        .encrypt();
      tx = await contract
        .connect(signers.owner)
        .tip(input.handles[0], input.inputProof);
      await tx.wait();

      expect(await contract.getTipCount()).to.equal(2);
    });
  });

  describe("Viewing Total", function () {
    it("should allow owner to view encrypted total", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(500)
        .encrypt();

      let tx = await contract
        .connect(signers.alice)
        .tip(input.handles[0], input.inputProof);
      await tx.wait();

      tx = await contract.connect(signers.owner).getTotalTips();
      await tx.wait();

      const total = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await contract.viewTotalTips(),
        contractAddress,
        signers.owner
      );

      expect(total).to.equal(500);
    });

    it("should prevent non-owner from viewing total", async function () {
      await expect(
        contract.connect(signers.alice).getTotalTips()
      ).to.be.revertedWith("Only owner can view total");
    });
  });

  describe("Reset", function () {
    it("should reset tips after withdrawal", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Add some tips
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(100)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .tip(input.handles[0], input.inputProof);
      await tx.wait();

      expect(await contract.getTipCount()).to.equal(1);

      // Reset
      await expect(contract.connect(signers.owner).resetTips()).to.emit(
        contract,
        "TipsWithdrawn"
      );

      expect(await contract.getTipCount()).to.equal(0);

      // Check total is 0
      tx = await contract.connect(signers.owner).getTotalTips();
      await tx.wait();

      const total = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await contract.viewTotalTips(),
        contractAddress,
        signers.owner
      );

      expect(total).to.equal(0);
    });

    it("should prevent non-owner from resetting", async function () {
      await expect(
        contract.connect(signers.alice).resetTips()
      ).to.be.revertedWith("Only owner");
    });
  });
});

```

{% endtab %}

{% endtabs %}
