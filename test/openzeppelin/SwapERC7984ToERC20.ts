/**
 * SwapERC7984ToERC20 Tests
 *
 * Tests for swapping confidential tokens to ERC20.
 * Validates:
 * - Contract initialization
 * - Swap initiation
 */

import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

describe("SwapERC7984ToERC20", function () {
  let swapContract: any;
  let confidentialToken: any;
  let erc20Token: any;
  let owner: any;
  let user: any;

  const INITIAL_AMOUNT = 10000n;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy confidential token
    confidentialToken = await ethers.deployContract("ERC7984Example", [
      owner.address,
      INITIAL_AMOUNT,
      "Confidential Token",
      "CTKN",
      "https://example.com/token",
    ]);

    // Deploy ERC20 token
    erc20Token = await ethers.deployContract("ERC20Mock", [
      "Regular Token",
      "RTKN",
      INITIAL_AMOUNT,
    ]);

    // Deploy swap contract
    swapContract = await ethers.deployContract("SwapERC7984ToERC20", [
      await confidentialToken.getAddress(),
      await erc20Token.getAddress(),
    ]);

    // Fund swap contract with ERC20 tokens
    await erc20Token.transfer(
      await swapContract.getAddress(),
      INITIAL_AMOUNT / 2n
    );
  });

  describe("Initialization", function () {
    it("should set the correct from token", async function () {
      expect(await swapContract.fromToken()).to.equal(
        await confidentialToken.getAddress()
      );
    });

    it("should set the correct to token", async function () {
      expect(await swapContract.toToken()).to.equal(
        await erc20Token.getAddress()
      );
    });
  });

  describe("Swap Initiation", function () {
    beforeEach(async function () {
      // Transfer confidential tokens to user
      const encryptedInput = await fhevm
        .createEncryptedInput(
          await confidentialToken.getAddress(),
          owner.address
        )
        .add64(1000n)
        .encrypt();

      await confidentialToken
        .connect(owner)
        ["confidentialTransfer(address,bytes32,bytes)"](
          user.address,
          encryptedInput.handles[0],
          encryptedInput.inputProof
        );

      // User approves swap contract as operator
      await confidentialToken
        .connect(user)
        .setOperator(await swapContract.getAddress(), true);
    });

    it("should initiate a swap", async function () {
      const encryptedInput = await fhevm
        .createEncryptedInput(
          await confidentialToken.getAddress(),
          user.address
        )
        .add64(100n)
        .encrypt();

      // Note: This initiates the swap but finalization requires gateway callback
      await expect(
        swapContract
          .connect(user)
          .swap(encryptedInput.handles[0], encryptedInput.inputProof)
      ).to.not.be.reverted;
    });
  });
});
