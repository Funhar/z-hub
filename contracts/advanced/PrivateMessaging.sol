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
