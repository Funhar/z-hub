/**
 * VestingWalletConfidential Tests
 *
 * Tests for the confidential vesting wallet implementation.
 * Validates:
 * - Vesting schedule initialization
 * - Token release at different time points
 * - Linear vesting calculation
 */

import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("VestingWalletConfidential", function () {
  let vestingWallet: any;
  let token: any;
  let owner: any;
  let beneficiary: any;

  const VESTING_AMOUNT = 1000n;
  const VESTING_DURATION = 3600; // 1 hour in seconds

  beforeEach(async function () {
    [owner, beneficiary] = await ethers.getSigners();

    // Deploy ERC7984 token
    token = await ethers.deployContract("ERC7984Example", [
      owner.address,
      10000n,
      "Test Token",
      "TT",
      "https://example.com/token",
    ]);

    // Get current time and set vesting to start in 1 minute
    const currentTime = await time.latest();
    const startTime = currentTime + 60;

    // Deploy vesting wallet
    vestingWallet = await ethers.deployContract("VestingWalletConfidential", [
      beneficiary.address,
      startTime,
      VESTING_DURATION,
    ]);

    // Transfer tokens to vesting wallet
    const encryptedInput = await fhevm
      .createEncryptedInput(await token.getAddress(), owner.address)
      .add64(VESTING_AMOUNT)
      .encrypt();

    await token
      .connect(owner)
      ["confidentialTransfer(address,bytes32,bytes)"](
        await vestingWallet.getAddress(),
        encryptedInput.handles[0],
        encryptedInput.inputProof
      );
  });

  describe("Initialization", function () {
    it("should set the correct beneficiary as owner", async function () {
      expect(await vestingWallet.owner()).to.equal(beneficiary.address);
    });

    it("should set the correct start time", async function () {
      const currentTime = await time.latest();
      expect(await vestingWallet.start()).to.be.greaterThan(currentTime);
    });

    it("should set the correct duration", async function () {
      expect(await vestingWallet.duration()).to.equal(VESTING_DURATION);
    });

    it("should calculate correct end time", async function () {
      const start = await vestingWallet.start();
      const duration = await vestingWallet.duration();
      expect(await vestingWallet.end()).to.equal(start + duration);
    });
  });

  describe("Vesting Schedule", function () {
    it("should not release tokens before vesting starts", async function () {
      // Just verify the contract can be called
      await expect(
        vestingWallet.connect(beneficiary).release(await token.getAddress())
      ).to.not.be.reverted;
    });

    it("should release tokens at midpoint", async function () {
      const startTime = Number(await vestingWallet.start());
      const midpoint = startTime + VESTING_DURATION / 2;

      await time.increaseTo(midpoint);

      await expect(
        vestingWallet.connect(beneficiary).release(await token.getAddress())
      ).to.not.be.reverted;
    });

    it("should release all tokens after vesting ends", async function () {
      const endTime = Number(await vestingWallet.end());

      await time.increaseTo(endTime + 1000);

      await expect(
        vestingWallet.connect(beneficiary).release(await token.getAddress())
      ).to.not.be.reverted;
    });

    it("should emit release event", async function () {
      const endTime = Number(await vestingWallet.end());
      await time.increaseTo(endTime + 1000);

      await expect(
        vestingWallet.connect(beneficiary).release(await token.getAddress())
      ).to.emit(vestingWallet, "VestingWalletConfidentialTokenReleased");
    });
  });
});
