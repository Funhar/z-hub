import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { DarkPool, DarkPool__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "DarkPool"
  )) as DarkPool__factory;
  const darkPool = (await factory.deploy()) as DarkPool;
  const darkPool_address = await darkPool.getAddress();

  return { darkPool, darkPool_address };
}

/**
 * Tests for DarkPool - encrypted order book
 */
describe("DarkPool", function () {
  let contract: DarkPool;
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
    contractAddress = deployment.darkPool_address;
    contract = deployment.darkPool;
  });

  describe("Order Placement", function () {
    it("should place encrypted buy order", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(100) // price
        .add64(50) // amount
        .encrypt();

      await expect(
        contract
          .connect(signers.alice)
          .placeBuyOrder(input.handles[0], input.handles[1], input.inputProof)
      ).to.emit(contract, "OrderPlaced");

      const order = await contract.orders(0);
      expect(order.trader).to.equal(signers.alice.address);
      expect(order.isBuyOrder).to.be.true;
      expect(order.status).to.equal(0); // OrderStatus.Open
    });

    it("should place encrypted sell order", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(95) // price
        .add64(30) // amount
        .encrypt();

      await expect(
        contract
          .connect(signers.alice)
          .placeSellOrder(input.handles[0], input.handles[1], input.inputProof)
      ).to.emit(contract, "OrderPlaced");

      const order = await contract.orders(0);
      expect(order.trader).to.equal(signers.alice.address);
      expect(order.isBuyOrder).to.be.false;
      expect(order.status).to.equal(0); // OrderStatus.Open
    });

    it("should allow owner to view their order details", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const price = 100;
      const amount = 50;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(price)
        .add64(amount)
        .encrypt();

      let tx = await contract
        .connect(signers.alice)
        .placeBuyOrder(input.handles[0], input.handles[1], input.inputProof);
      await tx.wait();

      // Get order details
      tx = await contract.connect(signers.alice).getOrderPrice(0);
      await tx.wait();
      tx = await contract.connect(signers.alice).getOrderAmount(0);
      await tx.wait();

      const decryptedPrice = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await contract.viewOrderPrice(0),
        contractAddress,
        signers.alice
      );

      const decryptedAmount = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        await contract.viewOrderAmount(0),
        contractAddress,
        signers.alice
      );

      expect(decryptedPrice).to.equal(price);
      expect(decryptedAmount).to.equal(amount);
    });
  });

  describe("Order Matching", function () {
    it("should match buy and sell orders", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Place buy order: price 100
      let input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(100)
        .add64(50)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .placeBuyOrder(input.handles[0], input.handles[1], input.inputProof);
      await tx.wait();

      // Place sell order: price 95 (lower than buy, should match)
      input = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add64(95)
        .add64(50)
        .encrypt();
      tx = await contract
        .connect(signers.owner)
        .placeSellOrder(input.handles[0], input.handles[1], input.inputProof);
      await tx.wait();

      // Match orders
      await expect(contract.matchOrders(0, 1)).to.emit(
        contract,
        "OrderMatched"
      );

      const buyOrder = await contract.orders(0);
      const sellOrder = await contract.orders(1);

      expect(buyOrder.status).to.equal(1); // OrderStatus.Filled
      expect(sellOrder.status).to.equal(1); // OrderStatus.Filled
    });
  });

  describe("Order Cancellation", function () {
    it("should allow owner to cancel their order", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(100)
        .add64(50)
        .encrypt();

      let tx = await contract
        .connect(signers.alice)
        .placeBuyOrder(input.handles[0], input.handles[1], input.inputProof);
      await tx.wait();

      await expect(contract.connect(signers.alice).cancelOrder(0)).to.emit(
        contract,
        "OrderCancelled"
      );

      const order = await contract.orders(0);
      expect(order.status).to.equal(2); // OrderStatus.Cancelled
    });

    it("should prevent non-owner from cancelling order", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(100)
        .add64(50)
        .encrypt();

      let tx = await contract
        .connect(signers.alice)
        .placeBuyOrder(input.handles[0], input.handles[1], input.inputProof);
      await tx.wait();

      await expect(
        contract.connect(signers.owner).cancelOrder(0)
      ).to.be.revertedWith("Not order owner");
    });
  });

  describe("Order Privacy", function () {
    it("should keep order details private from other users", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(100)
        .add64(50)
        .encrypt();

      let tx = await contract
        .connect(signers.alice)
        .placeBuyOrder(input.handles[0], input.handles[1], input.inputProof);
      await tx.wait();

      // Owner tries to view Alice's order
      await expect(
        contract.connect(signers.owner).getOrderPrice(0)
      ).to.be.revertedWith("Not order owner");
    });
  });
});
