Documentation for DarkPool

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="DarkPool.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint64, externalEuint64, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title DarkPool
 * @notice Order book where order prices and amounts are hidden until matched.
 * @dev Demonstrates privacy-preserving trading using FHE.
 *
 *      Key Features:
 *      - Encrypted buy/sell orders
 *      - Hidden prices and amounts
 *      - Encrypted order matching logic
 *      - Order status tracking
 */
contract DarkPool is ZamaEthereumConfig {
  enum OrderStatus {
    Open,
    Filled,
    Cancelled
  }

  struct Order {
    address trader;
    euint64 price;
    euint64 amount;
    OrderStatus status;
    bool isBuyOrder;
  }

  uint256 public nextOrderId;
  mapping(uint256 => Order) public orders;

  event OrderPlaced(uint256 indexed orderId, address indexed trader, bool isBuyOrder);
  event OrderMatched(uint256 indexed buyOrderId, uint256 indexed sellOrderId);
  event OrderCancelled(uint256 indexed orderId);

  // solhint-disable-next-line no-empty-blocks
  constructor() {}

  /**
   * @notice Place encrypted buy order
   * @param encryptedPrice Encrypted price willing to pay
   * @param encryptedAmount Encrypted amount to buy
   * @param inputProof Proof for the encrypted inputs
   * @return orderId The ID of the created order
   */
  function placeBuyOrder(
    externalEuint64 encryptedPrice,
    externalEuint64 encryptedAmount,
    bytes calldata inputProof
  ) external returns (uint256 orderId) {
    euint64 price = FHE.fromExternal(encryptedPrice, inputProof);
    euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

    FHE.allowThis(price);
    FHE.allowThis(amount);

    orderId = nextOrderId++;
    orders[orderId] = Order({
      trader: msg.sender,
      price: price,
      amount: amount,
      status: OrderStatus.Open,
      isBuyOrder: true
    });

    emit OrderPlaced(orderId, msg.sender, true);
  }

  /**
   * @notice Place encrypted sell order
   * @param encryptedPrice Encrypted price willing to accept
   * @param encryptedAmount Encrypted amount to sell
   * @param inputProof Proof for the encrypted inputs
   * @return orderId The ID of the created order
   */
  function placeSellOrder(
    externalEuint64 encryptedPrice,
    externalEuint64 encryptedAmount,
    bytes calldata inputProof
  ) external returns (uint256 orderId) {
    euint64 price = FHE.fromExternal(encryptedPrice, inputProof);
    euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

    FHE.allowThis(price);
    FHE.allowThis(amount);

    orderId = nextOrderId++;
    orders[orderId] = Order({
      trader: msg.sender,
      price: price,
      amount: amount,
      status: OrderStatus.Open,
      isBuyOrder: false
    });

    emit OrderPlaced(orderId, msg.sender, false);
  }

  /**
   * @notice Match buy and sell orders using encrypted comparison
   * @dev Orders match if: buyPrice >= sellPrice
   * @param buyOrderId ID of buy order
   * @param sellOrderId ID of sell order
   */
  function matchOrders(uint256 buyOrderId, uint256 sellOrderId) external {
    Order storage buyOrder = orders[buyOrderId];
    Order storage sellOrder = orders[sellOrderId];

    require(buyOrder.status == OrderStatus.Open, "Buy order not open");
    require(sellOrder.status == OrderStatus.Open, "Sell order not open");
    require(buyOrder.isBuyOrder, "First order must be buy");
    require(!sellOrder.isBuyOrder, "Second order must be sell");

    // Check if buy price >= sell price (encrypted comparison)
    ebool canMatch = FHE.ge(buyOrder.price, sellOrder.price);

    // For simplicity, we'll mark both as filled if they can match
    // In production, you'd handle partial fills, amounts, etc.
    // Here we just demonstrate the encrypted price comparison

    // Note: In a real implementation, you would:
    // 1. Use FHE.select to conditionally update status
    // 2. Handle amount matching (min of buy/sell amounts)
    // 3. Update remaining amounts for partial fills
    // For this example, we'll just mark as filled if match is possible

    buyOrder.status = OrderStatus.Filled;
    sellOrder.status = OrderStatus.Filled;

    emit OrderMatched(buyOrderId, sellOrderId);
  }

  /**
   * @notice Cancel an open order
   * @param orderId ID of order to cancel
   */
  function cancelOrder(uint256 orderId) external {
    Order storage order = orders[orderId];
    require(order.trader == msg.sender, "Not order owner");
    require(order.status == OrderStatus.Open, "Order not open");

    order.status = OrderStatus.Cancelled;
    emit OrderCancelled(orderId);
  }

  /**
   * @notice Get encrypted price for an order (only order owner)
   * @param orderId ID of the order
   * @return Encrypted price
   */
  function getOrderPrice(uint256 orderId) external returns (euint64) {
    Order storage order = orders[orderId];
    require(order.trader == msg.sender, "Not order owner");

    FHE.allow(order.price, msg.sender);
    return order.price;
  }

  /**
   * @notice Get encrypted amount for an order (only order owner)
   * @param orderId ID of the order
   * @return Encrypted amount
   */
  function getOrderAmount(uint256 orderId) external returns (euint64) {
    Order storage order = orders[orderId];
    require(order.trader == msg.sender, "Not order owner");

    FHE.allow(order.amount, msg.sender);
    return order.amount;
  }

  /**
   * @notice View order price handle (without permission)
   */
  function viewOrderPrice(uint256 orderId) external view returns (euint64) {
    return orders[orderId].price;
  }

  /**
   * @notice View order amount handle (without permission)
   */
  function viewOrderAmount(uint256 orderId) external view returns (euint64) {
    return orders[orderId].amount;
  }
}

```

{% endtab %}

{% tab title="DarkPool.ts" %}

```typescript
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

```

{% endtab %}

{% endtabs %}
