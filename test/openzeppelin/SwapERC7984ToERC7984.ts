/**
 * SwapERC7984ToERC7984 Tests
 *
 * Tests for swapping between two confidential tokens.
 * Validates:
 * - Contract initialization
 * - Confidential-to-confidential swap
 */

import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

describe("SwapERC7984ToERC7984", function () {
  let swapContract: any;
  let tokenA: any;
  let tokenB: any;
  let owner: any;
  let user: any;

  const INITIAL_AMOUNT = 10000n;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

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

    // Transfer some tokenB to swap contract for liquidity
    const encryptedInput = await fhevm
      .createEncryptedInput(await tokenB.getAddress(), owner.address)
      .add64(5000n)
      .encrypt();

    await tokenB
      .connect(owner)
      ["confidentialTransfer(address,bytes32,bytes)"](
        await swapContract.getAddress(),
        encryptedInput.handles[0],
        encryptedInput.inputProof
      );
  });

  describe("Swap", function () {
    beforeEach(async function () {
      // Transfer tokenA to user
      const encryptedInput = await fhevm
        .createEncryptedInput(await tokenA.getAddress(), owner.address)
        .add64(1000n)
        .encrypt();

      await tokenA
        .connect(owner)
        ["confidentialTransfer(address,bytes32,bytes)"](
          user.address,
          encryptedInput.handles[0],
          encryptedInput.inputProof
        );

      // User approves swap contract as operator for tokenA
      await tokenA
        .connect(user)
        .setOperator(await swapContract.getAddress(), true);
    });

    it("should swap confidential tokens", async function () {
      const encryptedInput = await fhevm
        .createEncryptedInput(await tokenA.getAddress(), user.address)
        .add64(100n)
        .encrypt();

      await expect(
        swapContract
          .connect(user)
          .swapConfidentialForConfidential(
            await tokenA.getAddress(),
            await tokenB.getAddress(),
            encryptedInput.handles[0],
            encryptedInput.inputProof
          )
      ).to.not.be.reverted;
    });

    it("should revert if not an operator", async function () {
      // Remove operator approval
      await tokenA
        .connect(user)
        .setOperator(await swapContract.getAddress(), false);

      const encryptedInput = await fhevm
        .createEncryptedInput(await tokenA.getAddress(), user.address)
        .add64(100n)
        .encrypt();

      await expect(
        swapContract
          .connect(user)
          .swapConfidentialForConfidential(
            await tokenA.getAddress(),
            await tokenB.getAddress(),
            encryptedInput.handles[0],
            encryptedInput.inputProof
          )
      ).to.be.reverted;
    });
  });
});
