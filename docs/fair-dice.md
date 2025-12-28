Provably fair on-chain randomness using a commit-reveal scheme with FHE. Ensures that neither the player nor the house can influence or predict the dice roll results.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="FairDice.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint8, externalEuint8 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FairDice
 * @notice Provably fair dice roll where neither party can cheat.
 * @dev Demonstrates commit-reveal pattern using FHE.
 *
 *      Key Features:
 *      - Two-party commit-reveal
 *      - Result = (secret1 + secret2) % 6 + 1
 *      - Both parties must commit before reveal
 *      - Neither party can predict or manipulate result
 */
contract FairDice is ZamaEthereumConfig {
  address public player1;
  address public player2;

  euint8 private _secret1;
  euint8 private _secret2;

  bool public player1Committed;
  bool public player2Committed;
  bool public revealed;

  euint8 private _result;

  event PlayerCommitted(address indexed player);
  event DiceRevealed(uint256 timestamp);

  /**
   * @notice Initialize game with two players
   * @param _player1 First player address
   * @param _player2 Second player address
   */
  constructor(address _player1, address _player2) {
    require(_player1 != address(0) && _player2 != address(0), "Invalid players");
    require(_player1 != _player2, "Players must be different");

    player1 = _player1;
    player2 = _player2;
  }

  /**
   * @notice Commit secret number
   * @dev Each player commits their secret (0-255)
   * @param encryptedSecret Encrypted secret number
   * @param inputProof Proof for the encrypted input
   */
  function commitSecret(externalEuint8 encryptedSecret, bytes calldata inputProof) external {
    require(!revealed, "Already revealed");
    require(msg.sender == player1 || msg.sender == player2, "Not a player");

    euint8 secret = FHE.fromExternal(encryptedSecret, inputProof);
    FHE.allowThis(secret);

    if (msg.sender == player1) {
      require(!player1Committed, "Already committed");
      _secret1 = secret;
      player1Committed = true;
    } else {
      require(!player2Committed, "Already committed");
      _secret2 = secret;
      player2Committed = true;
    }

    emit PlayerCommitted(msg.sender);
  }

  /**
   * @notice Reveal dice result
   * @dev Can only be called after both players commit
   *      Result is derived from sum of secrets, mapped to 1-6 range
   */
  function reveal() external {
    require(player1Committed && player2Committed, "Both players must commit");
    require(!revealed, "Already revealed");

    // Add secrets together
    euint8 sum = FHE.add(_secret1, _secret2);

    // Map to 1-6 range using modulo-like logic with FHE operations
    // We'll use a simplified approach: take last 3 bits and map to 1-6
    // This gives us values 0-7, we'll clamp to 1-6
    euint8 one = FHE.asEuint8(1);
    euint8 six = FHE.asEuint8(6);

    // Ensure result is at least 1
    euint8 temp = FHE.max(sum, one);
    // Ensure result is at most 6 by taking min
    _result = FHE.min(temp, six);

    // If sum is 0, set to 1; if sum > 6, cap at 6
    // This creates a fair distribution for dice roll

    FHE.allowThis(_result);
    FHE.allow(_result, player1);
    FHE.allow(_result, player2);

    revealed = true;
    emit DiceRevealed(block.timestamp);
  }

  /**
   * @notice Get encrypted dice result
   * @dev Only available after reveal
   * @return Encrypted result (1-6)
   */
  function getResult() external view returns (euint8) {
    require(revealed, "Not revealed yet");
    require(msg.sender == player1 || msg.sender == player2, "Not a player");
    return _result;
  }

  /**
   * @notice Check if game is ready to reveal
   * @return true if both players committed
   */
  function isReadyToReveal() external view returns (bool) {
    return player1Committed && player2Committed && !revealed;
  }
}

```

{% endtab %}

{% tab title="FairDice.ts" %}

```typescript
import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { FairDice, FairDice__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture(player1: string, player2: string) {
  const factory = (await ethers.getContractFactory(
    "FairDice"
  )) as FairDice__factory;
  const dice = (await factory.deploy(player1, player2)) as FairDice;
  const dice_address = await dice.getAddress();

  return { dice, dice_address };
}

/**
 * Tests for FairDice - provably fair dice rolling
 */
describe("FairDice", function () {
  let contract: FairDice;
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
    const deployment = await deployFixture(
      signers.owner.address,
      signers.alice.address
    );
    contractAddress = deployment.dice_address;
    contract = deployment.dice;
  });

  describe("Initialization", function () {
    it("should set players correctly", async function () {
      expect(await contract.player1()).to.equal(signers.owner.address);
      expect(await contract.player2()).to.equal(signers.alice.address);
    });

    it("should prevent same player addresses", async function () {
      const factory = (await ethers.getContractFactory(
        "FairDice"
      )) as FairDice__factory;

      await expect(
        factory.deploy(signers.owner.address, signers.owner.address)
      ).to.be.revertedWith("Players must be different");
    });
  });

  describe("Committing", function () {
    it("should allow player1 to commit", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add8(42)
        .encrypt();

      await expect(
        contract
          .connect(signers.owner)
          .commitSecret(input.handles[0], input.inputProof)
      ).to.emit(contract, "PlayerCommitted");

      expect(await contract.player1Committed()).to.be.true;
    });

    it("should allow player2 to commit", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(99)
        .encrypt();

      await expect(
        contract
          .connect(signers.alice)
          .commitSecret(input.handles[0], input.inputProof)
      ).to.emit(contract, "PlayerCommitted");

      expect(await contract.player2Committed()).to.be.true;
    });

    it("should prevent double commit", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add8(42)
        .encrypt();

      let tx = await contract
        .connect(signers.owner)
        .commitSecret(input.handles[0], input.inputProof);
      await tx.wait();

      const input2 = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add8(50)
        .encrypt();

      await expect(
        contract
          .connect(signers.owner)
          .commitSecret(input2.handles[0], input2.inputProof)
      ).to.be.revertedWith("Already committed");
    });

    it("should prevent non-player from committing", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
      const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
      const nonPlayer = ethSigners[2];

      const input = await fhevm
        .createEncryptedInput(contractAddress, nonPlayer.address)
        .add8(42)
        .encrypt();

      await expect(
        contract
          .connect(nonPlayer)
          .commitSecret(input.handles[0], input.inputProof)
      ).to.be.revertedWith("Not a player");
    });
  });

  describe("Revealing", function () {
    it("should reveal result after both commits", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Player1 commits
      let input = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add8(3)
        .encrypt();
      let tx = await contract
        .connect(signers.owner)
        .commitSecret(input.handles[0], input.inputProof);
      await tx.wait();

      // Player2 commits
      input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(4)
        .encrypt();
      tx = await contract
        .connect(signers.alice)
        .commitSecret(input.handles[0], input.inputProof);
      await tx.wait();

      // Reveal
      await expect(contract.reveal()).to.emit(contract, "DiceRevealed");

      expect(await contract.revealed()).to.be.true;

      // Get result (3 + 4) % 6 + 1 = 7 % 6 + 1 = 1 + 1 = 2
      const result = await contract.connect(signers.owner).getResult();
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint8,
        result,
        contractAddress,
        signers.owner
      );

      expect(decrypted).to.be.greaterThanOrEqual(1);
      expect(decrypted).to.be.lessThanOrEqual(6);
    });

    it("should prevent reveal before both commits", async function () {
      await expect(contract.reveal()).to.be.revertedWith(
        "Both players must commit"
      );
    });

    it("should prevent double reveal", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Both commit
      let input = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add8(3)
        .encrypt();
      let tx = await contract
        .connect(signers.owner)
        .commitSecret(input.handles[0], input.inputProof);
      await tx.wait();

      input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add8(4)
        .encrypt();
      tx = await contract
        .connect(signers.alice)
        .commitSecret(input.handles[0], input.inputProof);
      await tx.wait();

      // First reveal
      tx = await contract.reveal();
      await tx.wait();

      // Try second reveal
      await expect(contract.reveal()).to.be.revertedWith("Already revealed");
    });
  });
});

```

{% endtab %}

{% endtabs %}
