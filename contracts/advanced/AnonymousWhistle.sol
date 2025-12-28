// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint256, externalEuint256 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title AnonymousWhistle
 * @notice Anonymous whistleblowing/reporting system with identity protection.
 * @dev Demonstrates privacy-preserving reporting using FHE.
 *
 *      Key Features:
 *      - Encrypted report content
 *      - Reporter identity never stored
 *      - Only admin can decrypt reports
 *      - Public metadata (timestamp, id)
 */
contract AnonymousWhistle is ZamaEthereumConfig {
  address public admin;

  struct Report {
    euint256 encryptedContent;
    uint256 timestamp;
    uint256 id;
  }

  Report[] private _reports;

  event ReportSubmitted(uint256 indexed reportId, uint256 timestamp);

  /**
   * @notice Initialize with admin
   */
  constructor() {
    admin = msg.sender;
  }

  /**
   * @notice Submit anonymous report
   * @dev Reporter address is not stored, ensuring anonymity
   * @param encryptedReport Encrypted report content
   * @param inputProof Proof for the encrypted input
   */
  function submitReport(
    externalEuint256 encryptedReport,
    bytes calldata inputProof
  ) external {
    euint256 content = FHE.fromExternal(encryptedReport, inputProof);
    FHE.allowThis(content);
    FHE.allow(content, admin);

    uint256 reportId = _reports.length;

    _reports.push(
      Report({encryptedContent: content, timestamp: block.timestamp, id: reportId})
    );

    emit ReportSubmitted(reportId, block.timestamp);
  }

  /**
   * @notice Get total number of reports
   * @return count Number of reports
   */
  function getReportCount() external view returns (uint256) {
    return _reports.length;
  }

  /**
   * @notice Get report metadata (timestamp, id)
   * @param reportId Report ID
   * @return timestamp Report timestamp
   * @return id Report ID
   */
  function getReportMetadata(uint256 reportId)
    external
    view
    returns (uint256 timestamp, uint256 id)
  {
    require(reportId < _reports.length, "Invalid report ID");
    Report storage report = _reports[reportId];
    return (report.timestamp, report.id);
  }

  /**
   * @notice Get encrypted report content (admin only)
   * @param reportId Report ID
   * @return Encrypted report content
   */
  function getReport(uint256 reportId) external view returns (euint256) {
    require(msg.sender == admin, "Only admin can view reports");
    require(reportId < _reports.length, "Invalid report ID");

    return _reports[reportId].encryptedContent;
  }

  /**
   * @notice Change admin (current admin only)
   * @param newAdmin New admin address
   */
  function changeAdmin(address newAdmin) external {
    require(msg.sender == admin, "Only admin");
    require(newAdmin != address(0), "Invalid address");

    admin = newAdmin;
  }
}
