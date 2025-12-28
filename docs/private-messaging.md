Send and receive private messages directly on-chain. Message content is encrypted for the recipient only, allowing secure, decentralized communication without relayers.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="PrivateMessaging.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint256, externalEuint256 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title PrivateMessaging
 * @notice Address-based encrypted messaging where only recipient can decrypt.
 * @dev Demonstrates privacy-preserving messaging using FHE.
 *
 *      Key Features:
 *      - Encrypted message content (euint256)
 *      - Only recipient can decrypt
 *      - Message history per user
 *      - Sender and recipient are public, content is private
 */
contract PrivateMessaging is ZamaEthereumConfig {
  struct Message {
    address sender;
    address recipient;
    euint256 encryptedContent;
    uint256 timestamp;
  }

  // Mapping from recipient to their messages
  mapping(address => Message[]) private _inbox;

  event MessageSent(address indexed sender, address indexed recipient, uint256 timestamp);

  // solhint-disable-next-line no-empty-blocks
  constructor() {}

  /**
   * @notice Send encrypted message to recipient
   * @param recipient Address to send message to
   * @param encryptedContent Encrypted message content
   * @param inputProof Proof for the encrypted input
   */
  function sendMessage(
    address recipient,
    externalEuint256 encryptedContent,
    bytes calldata inputProof
  ) external {
    require(recipient != address(0), "Invalid recipient");
    require(recipient != msg.sender, "Cannot send to self");

    euint256 content = FHE.fromExternal(encryptedContent, inputProof);
    FHE.allowThis(content);

    // Grant permission to recipient only
    FHE.allow(content, recipient);

    _inbox[recipient].push(
      Message({
        sender: msg.sender,
        recipient: recipient,
        encryptedContent: content,
        timestamp: block.timestamp
      })
    );

    emit MessageSent(msg.sender, recipient, block.timestamp);
  }

  /**
   * @notice Get number of messages in inbox
   * @return count Number of messages
   */
  function getMessageCount() external view returns (uint256) {
    return _inbox[msg.sender].length;
  }

  /**
   * @notice Get message metadata (sender, timestamp)
   * @param index Message index in inbox
   * @return sender Message sender
   * @return timestamp Message timestamp
   */
  function getMessageMetadata(uint256 index)
    external
    view
    returns (address sender, uint256 timestamp)
  {
    require(index < _inbox[msg.sender].length, "Invalid index");
    Message storage message = _inbox[msg.sender][index];
    return (message.sender, message.timestamp);
  }

  /**
   * @notice Get encrypted message content
   * @dev Caller must be the recipient to decrypt
   * @param index Message index in inbox
   * @return Encrypted message content
   */
  function getMessage(uint256 index) external view returns (euint256) {
    require(index < _inbox[msg.sender].length, "Invalid index");
    return _inbox[msg.sender][index].encryptedContent;
  }

  /**
   * @notice Delete message from inbox
   * @param index Message index to delete
   */
  function deleteMessage(uint256 index) external {
    require(index < _inbox[msg.sender].length, "Invalid index");

    // Move last message to deleted position
    uint256 lastIndex = _inbox[msg.sender].length - 1;
    if (index != lastIndex) {
      _inbox[msg.sender][index] = _inbox[msg.sender][lastIndex];
    }
    _inbox[msg.sender].pop();
  }
}

```

{% endtab %}

{% tab title="PrivateMessaging.ts" %}

```typescript
import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { PrivateMessaging, PrivateMessaging__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "PrivateMessaging"
  )) as PrivateMessaging__factory;
  const messaging = (await factory.deploy()) as PrivateMessaging;
  const messaging_address = await messaging.getAddress();

  return { messaging, messaging_address };
}

/**
 * Tests for PrivateMessaging - encrypted messaging system
 */
describe("PrivateMessaging", function () {
  let contract: PrivateMessaging;
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
    contractAddress = deployment.messaging_address;
    contract = deployment.messaging;
  });

  describe("Sending Messages", function () {
    it("should send encrypted message to recipient", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add256(12345n) // message content
        .encrypt();

      await expect(
        contract
          .connect(signers.owner)
          .sendMessage(
            signers.alice.address,
            input.handles[0],
            input.inputProof
          )
      ).to.emit(contract, "MessageSent");

      const count = await contract.connect(signers.alice).getMessageCount();
      expect(count).to.equal(1);
    });

    it("should prevent sending to self", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add256(12345n)
        .encrypt();

      await expect(
        contract
          .connect(signers.owner)
          .sendMessage(
            signers.owner.address,
            input.handles[0],
            input.inputProof
          )
      ).to.be.revertedWith("Cannot send to self");
    });

    it("should prevent sending to zero address", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add256(12345n)
        .encrypt();

      await expect(
        contract
          .connect(signers.owner)
          .sendMessage(ethers.ZeroAddress, input.handles[0], input.inputProof)
      ).to.be.revertedWith("Invalid recipient");
    });
  });

  describe("Reading Messages", function () {
    it("should allow recipient to decrypt message", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
      const messageContent = 98765n;

      // Send message
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add256(messageContent)
        .encrypt();

      let tx = await contract
        .connect(signers.owner)
        .sendMessage(signers.alice.address, input.handles[0], input.inputProof);
      await tx.wait();

      // Read message
      const encryptedMsg = await contract.connect(signers.alice).getMessage(0);
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint256,
        encryptedMsg,
        contractAddress,
        signers.alice
      );

      expect(decrypted).to.equal(messageContent);
    });

    it("should get correct message metadata", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add256(12345n)
        .encrypt();

      let tx = await contract
        .connect(signers.owner)
        .sendMessage(signers.alice.address, input.handles[0], input.inputProof);
      await tx.wait();

      const [sender, timestamp] = await contract
        .connect(signers.alice)
        .getMessageMetadata(0);

      expect(sender).to.equal(signers.owner.address);
      expect(timestamp).to.be.greaterThan(0);
    });

    it("should handle multiple messages", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Send 3 messages
      for (let i = 0; i < 3; i++) {
        const input = await fhevm
          .createEncryptedInput(contractAddress, signers.owner.address)
          .add256(BigInt(1000 + i))
          .encrypt();

        let tx = await contract
          .connect(signers.owner)
          .sendMessage(
            signers.alice.address,
            input.handles[0],
            input.inputProof
          );
        await tx.wait();
      }

      const count = await contract.connect(signers.alice).getMessageCount();
      expect(count).to.equal(3);
    });
  });

  describe("Message Deletion", function () {
    it("should delete message from inbox", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Send message
      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add256(12345n)
        .encrypt();

      let tx = await contract
        .connect(signers.owner)
        .sendMessage(signers.alice.address, input.handles[0], input.inputProof);
      await tx.wait();

      expect(await contract.connect(signers.alice).getMessageCount()).to.equal(
        1
      );

      // Delete message
      tx = await contract.connect(signers.alice).deleteMessage(0);
      await tx.wait();

      expect(await contract.connect(signers.alice).getMessageCount()).to.equal(
        0
      );
    });

    it("should prevent deleting invalid index", async function () {
      await expect(
        contract.connect(signers.alice).deleteMessage(0)
      ).to.be.revertedWith("Invalid index");
    });
  });
});

```

{% endtab %}

{% endtabs %}
