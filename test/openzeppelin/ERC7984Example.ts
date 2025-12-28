/**
 * ERC7984Example Tests
 *
 * Tests for the confidential ERC7984 token implementation.
 * Validates:
 * - Token initialization (name, symbol, URI)
 * - Initial minting to owner
 * - Confidential transfers between accounts
 * - Mint and burn operations (owner only)
 */

import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

describe("ERC7984Example", function () {
  let token: any;
  let owner: any;
  let recipient: any;
  let other: any;

  const INITIAL_AMOUNT = 1000n;
  const TRANSFER_AMOUNT = 100n;

  beforeEach(async function () {
    [owner, recipient, other] = await ethers.getSigners();

    // Deploy ERC7984Example contract
    token = await ethers.deployContract("ERC7984Example", [
      owner.address,
      INITIAL_AMOUNT,
      "Confidential Token",
      "CTKN",
      "https://example.com/token",
    ]);
  });

  describe("Initialization", function () {
    it("should set the correct name", async function () {
      expect(await token.name()).to.equal("Confidential Token");
    });

    it("should set the correct symbol", async function () {
      expect(await token.symbol()).to.equal("CTKN");
    });

    it("should set the correct contract URI", async function () {
      expect(await token.contractURI()).to.equal("https://example.com/token");
    });

    it("should mint initial amount to owner", async function () {
      // Verify that the owner has a balance handle
      const balanceHandle = await token.confidentialBalanceOf(owner.address);
      expect(balanceHandle).to.not.equal(0n);
    });

    it("should set the correct owner", async function () {
      expect(await token.owner()).to.equal(owner.address);
    });
  });

  describe("Confidential Transfer", function () {
    it("should transfer tokens from owner to recipient", async function () {
      // Create encrypted input for transfer amount
      const encryptedInput = await fhevm
        .createEncryptedInput(await token.getAddress(), owner.address)
        .add64(TRANSFER_AMOUNT)
        .encrypt();

      // Perform the confidential transfer
      await expect(
        token
          .connect(owner)
          ["confidentialTransfer(address,bytes32,bytes)"](
            recipient.address,
            encryptedInput.handles[0],
            encryptedInput.inputProof
          )
      ).to.not.be.reverted;

      // Check that recipient has a balance handle
      const recipientBalanceHandle = await token.confidentialBalanceOf(
        recipient.address
      );
      expect(recipientBalanceHandle).to.not.equal(0n);
    });

    it("should allow recipient to transfer received tokens", async function () {
      // First transfer from owner to recipient
      const encryptedInput1 = await fhevm
        .createEncryptedInput(await token.getAddress(), owner.address)
        .add64(TRANSFER_AMOUNT)
        .encrypt();

      await token
        .connect(owner)
        ["confidentialTransfer(address,bytes32,bytes)"](
          recipient.address,
          encryptedInput1.handles[0],
          encryptedInput1.inputProof
        );

      // Second transfer from recipient to other
      const encryptedInput2 = await fhevm
        .createEncryptedInput(await token.getAddress(), recipient.address)
        .add64(50n)
        .encrypt();

      await expect(
        token
          .connect(recipient)
          ["confidentialTransfer(address,bytes32,bytes)"](
            other.address,
            encryptedInput2.handles[0],
            encryptedInput2.inputProof
          )
      ).to.not.be.reverted;

      // Check that other has a balance handle
      const otherBalanceHandle = await token.confidentialBalanceOf(
        other.address
      );
      expect(otherBalanceHandle).to.not.equal(0n);
    });

    it("should revert when transferring to zero address", async function () {
      const encryptedInput = await fhevm
        .createEncryptedInput(await token.getAddress(), owner.address)
        .add64(TRANSFER_AMOUNT)
        .encrypt();

      await expect(
        token
          .connect(owner)
          ["confidentialTransfer(address,bytes32,bytes)"](
            ethers.ZeroAddress,
            encryptedInput.handles[0],
            encryptedInput.inputProof
          )
      ).to.be.revertedWithCustomError(token, "ERC7984InvalidReceiver");
    });
  });

  describe("Minting", function () {
    it("should allow owner to mint with clear amount", async function () {
      await expect(token.connect(owner).mint(recipient.address, 500n)).to.not.be
        .reverted;

      const balanceHandle = await token.confidentialBalanceOf(
        recipient.address
      );
      expect(balanceHandle).to.not.equal(0n);
    });

    it("should allow owner to mint with encrypted amount", async function () {
      const encryptedInput = await fhevm
        .createEncryptedInput(await token.getAddress(), owner.address)
        .add64(500n)
        .encrypt();

      await expect(
        token
          .connect(owner)
          .confidentialMint(
            recipient.address,
            encryptedInput.handles[0],
            encryptedInput.inputProof
          )
      ).to.not.be.reverted;
    });

    it("should revert when non-owner tries to mint", async function () {
      await expect(
        token.connect(other).mint(recipient.address, 500n)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });

  describe("Burning", function () {
    it("should allow owner to burn with clear amount", async function () {
      await expect(token.connect(owner).burn(owner.address, 100n)).to.not.be
        .reverted;
    });

    it("should revert when non-owner tries to burn", async function () {
      await expect(
        token.connect(other).burn(owner.address, 100n)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });
});
