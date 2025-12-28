A secure whistleblowing platform protecting reporter identity using FHEVM. Enables individuals to submit encrypted reports that can only be decrypted by authorized parties.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="AnonymousWhistle.sol" %}

```solidity
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

```

{% endtab %}

{% tab title="AnonymousWhistle.ts" %}

```typescript
import {
  FhevmType,
  HardhatFhevmRuntimeEnvironment,
} from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import * as hre from "hardhat";

import { AnonymousWhistle, AnonymousWhistle__factory } from "../../../types";
import type { Signers } from "../../types";

async function deployFixture() {
  const factory = (await ethers.getContractFactory(
    "AnonymousWhistle"
  )) as AnonymousWhistle__factory;
  const whistle = (await factory.deploy()) as AnonymousWhistle;
  const whistle_address = await whistle.getAddress();

  return { whistle, whistle_address };
}

/**
 * Tests for AnonymousWhistle - anonymous reporting system
 */
describe("AnonymousWhistle", function () {
  let contract: AnonymousWhistle;
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
    contractAddress = deployment.whistle_address;
    contract = deployment.whistle;
  });

  describe("Submitting Reports", function () {
    it("should submit anonymous report", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add256(123456789n)
        .encrypt();

      await expect(
        contract
          .connect(signers.alice)
          .submitReport(input.handles[0], input.inputProof)
      ).to.emit(contract, "ReportSubmitted");

      expect(await contract.getReportCount()).to.equal(1);
    });

    it("should accept multiple reports", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Submit 3 reports
      for (let i = 0; i < 3; i++) {
        const input = await fhevm
          .createEncryptedInput(contractAddress, signers.alice.address)
          .add256(BigInt(1000 + i))
          .encrypt();

        let tx = await contract
          .connect(signers.alice)
          .submitReport(input.handles[0], input.inputProof);
        await tx.wait();
      }

      expect(await contract.getReportCount()).to.equal(3);
    });

    it("should accept reports from different addresses", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      // Alice submits
      let input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add256(111n)
        .encrypt();
      let tx = await contract
        .connect(signers.alice)
        .submitReport(input.handles[0], input.inputProof);
      await tx.wait();

      // Owner submits
      input = await fhevm
        .createEncryptedInput(contractAddress, signers.owner.address)
        .add256(222n)
        .encrypt();
      tx = await contract
        .connect(signers.owner)
        .submitReport(input.handles[0], input.inputProof);
      await tx.wait();

      expect(await contract.getReportCount()).to.equal(2);
    });
  });

  describe("Viewing Reports", function () {
    it("should allow admin to view encrypted report", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;
      const reportContent = 987654321n;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add256(reportContent)
        .encrypt();

      let tx = await contract
        .connect(signers.alice)
        .submitReport(input.handles[0], input.inputProof);
      await tx.wait();

      const encrypted = await contract.connect(signers.owner).getReport(0);
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint256,
        encrypted,
        contractAddress,
        signers.owner
      );

      expect(decrypted).to.equal(reportContent);
    });

    it("should prevent non-admin from viewing reports", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add256(123n)
        .encrypt();

      let tx = await contract
        .connect(signers.alice)
        .submitReport(input.handles[0], input.inputProof);
      await tx.wait();

      await expect(
        contract.connect(signers.alice).getReport(0)
      ).to.be.revertedWith("Only admin can view reports");
    });

    it("should get correct report metadata", async function () {
      const fhevm: HardhatFhevmRuntimeEnvironment = hre.fhevm;

      const input = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add256(123n)
        .encrypt();

      let tx = await contract
        .connect(signers.alice)
        .submitReport(input.handles[0], input.inputProof);
      await tx.wait();

      const [timestamp, id] = await contract.getReportMetadata(0);

      expect(id).to.equal(0);
      expect(timestamp).to.be.greaterThan(0);
    });
  });

  describe("Admin Management", function () {
    it("should allow admin to change admin", async function () {
      await contract.connect(signers.owner).changeAdmin(signers.alice.address);

      expect(await contract.admin()).to.equal(signers.alice.address);
    });

    it("should prevent non-admin from changing admin", async function () {
      await expect(
        contract.connect(signers.alice).changeAdmin(signers.alice.address)
      ).to.be.revertedWith("Only admin");
    });

    it("should prevent setting zero address as admin", async function () {
      await expect(
        contract.connect(signers.owner).changeAdmin(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });
  });
});

```

{% endtab %}

{% endtabs %}
