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
