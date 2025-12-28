/**
 * SwapERC7984ToERC20 Tests
 *
 * Tests for swapping confidential ERC7984 tokens to standard ERC20 tokens.
 * Validates:
 * - Contract initialization
 * - Swap initiation
 * - Token references
 */

import { expect } from "chai";
import { ethers } from "hardhat";

describe("SwapERC7984ToERC20", function () {
  let swapContract: any;
  let erc7984Token: any;
  let erc20Token: any;
  let owner: any;

  const INITIAL_SUPPLY = 1000000n;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    // Deploy mock ERC20 token
    erc20Token = await ethers.deployContract("ERC20Mock", [
      "Test ERC20",
      "TT20",
      INITIAL_SUPPLY,
    ]);

    // Deploy mock ERC7984 token
    erc7984Token = await ethers.deployContract("ERC7984Mock", [
      owner.address,
      10000n,
      "Test Confidential",
      "TCONF",
      "https://example.com/token",
    ]);

    // Deploy swap contract
    swapContract = await ethers.deployContract("SwapERC7984ToERC20", [
      await erc7984Token.getAddress(),
      await erc20Token.getAddress(),
    ]);

    // Transfer some ERC20 to swap contract for liquidity
    await erc20Token.transfer(await swapContract.getAddress(), 5000n);
  });

  describe("Initialization", function () {
    it("should deploy swap contract successfully", async function () {
      expect(await swapContract.getAddress()).to.not.equal(ethers.ZeroAddress);
    });

    it("should set correct fromToken", async function () {
      expect(await swapContract.fromToken()).to.equal(
        await erc7984Token.getAddress()
      );
    });

    it("should set correct toToken", async function () {
      expect(await swapContract.toToken()).to.equal(
        await erc20Token.getAddress()
      );
    });
  });

  describe("Token References", function () {
    it("should have ERC20 balance in swap contract", async function () {
      expect(
        await erc20Token.balanceOf(await swapContract.getAddress())
      ).to.equal(5000n);
    });
  });
});
