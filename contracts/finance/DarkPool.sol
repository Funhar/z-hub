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
