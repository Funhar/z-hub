/**
 * SwapERC7984ToERC7984 Tests
 *
 * Tests for swapping between two confidential tokens.
 * Validates:
 * - Contract initialization
 * - Token deployments
 */

import { expect } from "chai";
import { ethers } from "hardhat";

describe("SwapERC7984ToERC7984", function () {
  let swapContract: any;
  let tokenA: any;
  let tokenB: any;
  let owner: any;

  const INITIAL_AMOUNT = 10000n;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    // Deploy two confidential tokens
    tokenA = await ethers.deployContract("ERC7984Example", [
      owner.address,
      INITIAL_AMOUNT,
      "Token A",
      "TKNA",
      "https://example.com/token-a",
    ]);

    tokenB = await ethers.deployContract("ERC7984Example", [
      owner.address,
      INITIAL_AMOUNT,
      "Token B",
      "TKNB",
      "https://example.com/token-b",
    ]);

    // Deploy swap contract
    swapContract = await ethers.deployContract("SwapERC7984ToERC7984", []);
  });

  describe("Initialization", function () {
    it("should deploy swap contract successfully", async function () {
      expect(await swapContract.getAddress()).to.not.equal(ethers.ZeroAddress);
    });

    it("should deploy token A successfully", async function () {
      expect(await tokenA.name()).to.equal("Token A");
      expect(await tokenA.symbol()).to.equal("TKNA");
    });

    it("should deploy token B successfully", async function () {
      expect(await tokenB.name()).to.equal("Token B");
      expect(await tokenB.symbol()).to.equal("TKNB");
    });
  });
});
