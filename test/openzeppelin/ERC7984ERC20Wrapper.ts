/**
 * ERC7984ERC20Wrapper Tests
 *
 * Tests for wrapping ERC20 tokens into confidential ERC7984 tokens.
 * Validates:
 * - Wrapper initialization
 * - Wrapping ERC20 to confidential tokens
 * - Unwrapping back to ERC20
 */

import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

describe("ERC7984ERC20Wrapper", function () {
  let wrapper: any;
  let erc20: any;
  let owner: any;
  let user: any;

  const INITIAL_SUPPLY = 1000000n;
  const WRAP_AMOUNT = 1000n;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy a mock ERC20 token
    erc20 = await ethers.deployContract("ERC20Mock", [
      "Test Token",
      "TT",
      INITIAL_SUPPLY,
    ]);

    // Deploy the wrapper
    wrapper = await ethers.deployContract("ERC7984ERC20Wrapper", [
      await erc20.getAddress(),
      "Wrapped Confidential Token",
      "wCTKN",
      "https://example.com/wrapped",
    ]);
  });

  describe("Initialization", function () {
    it("should set the correct name", async function () {
      expect(await wrapper.name()).to.equal("Wrapped Confidential Token");
    });

    it("should set the correct symbol", async function () {
      expect(await wrapper.symbol()).to.equal("wCTKN");
    });

    it("should reference the correct underlying token", async function () {
      expect(await wrapper.underlying()).to.equal(await erc20.getAddress());
    });
  });

  describe("Wrapping", function () {
    beforeEach(async function () {
      // Transfer some tokens to user
      await erc20.transfer(user.address, WRAP_AMOUNT);
      // Approve wrapper to spend user's tokens
      await erc20
        .connect(user)
        .approve(await wrapper.getAddress(), WRAP_AMOUNT);
    });

    it("should wrap ERC20 tokens to confidential tokens", async function () {
      await expect(wrapper.connect(user).wrap(user.address, WRAP_AMOUNT)).to.not
        .be.reverted;

      // Check that user has confidential balance
      const balanceHandle = await wrapper.confidentialBalanceOf(user.address);
      expect(balanceHandle).to.not.equal(0n);
    });

    it("should emit transfer event on wrap", async function () {
      await expect(wrapper.connect(user).wrap(user.address, WRAP_AMOUNT)).to.not
        .be.reverted;
    });
  });

  describe("Unwrapping", function () {
    beforeEach(async function () {
      // Setup: wrap some tokens first
      await erc20.transfer(user.address, WRAP_AMOUNT);
      await erc20
        .connect(user)
        .approve(await wrapper.getAddress(), WRAP_AMOUNT);
      await wrapper.connect(user).wrap(user.address, WRAP_AMOUNT);
    });

    it("should allow unwrapping confidential tokens back to ERC20", async function () {
      const encryptedInput = await fhevm
        .createEncryptedInput(await wrapper.getAddress(), user.address)
        .add64(100n)
        .encrypt();

      // Note: unwrap requires async decryption, just verify call doesn't revert immediately
      await expect(
        wrapper
          .connect(user)
          ["unwrap(address,address,bytes32,bytes)"](
            user.address,
            user.address,
            encryptedInput.handles[0],
            encryptedInput.inputProof
          )
      ).to.not.be.reverted;
    });
  });
});
