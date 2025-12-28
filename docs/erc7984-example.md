A full-featured confidential token based on the ERC7984 standard. Learn about private minting, burning, and balance management using FHEVM to ensure transaction privacy.

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="ERC7984Example.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/**
 * @title ERC7984Example
 * @notice Basic confidential fungible token implementation using ERC7984 standard
 * @dev Demonstrates:
 *   - Confidential token creation with encrypted balances
 *   - Initial minting with clear amount (converted to encrypted)
 *   - Integration with OpenZeppelin's Ownable2Step for access control
 */

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {FHE, externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";

contract ERC7984Example is ZamaEthereumConfig, ERC7984, Ownable2Step {
    /**
     * @notice Creates a new confidential token
     * @param owner Address that will own the contract and receive initial tokens
     * @param amount Initial supply to mint (in clear, will be encrypted)
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param tokenURI_ Contract metadata URI
     */
    constructor(
        address owner,
        uint64 amount,
        string memory name_,
        string memory symbol_,
        string memory tokenURI_
    ) ERC7984(name_, symbol_, tokenURI_) Ownable(owner) {
        euint64 encryptedAmount = FHE.asEuint64(amount);
        _mint(owner, encryptedAmount);
    }

    /**
     * @notice Mints new tokens with a clear amount (owner only)
     * @param to Recipient address
     * @param amount Amount to mint (in clear)
     */
    function mint(address to, uint64 amount) external onlyOwner {
        _mint(to, FHE.asEuint64(amount));
    }

    /**
     * @notice Mints new tokens with an encrypted amount (owner only)
     * @param to Recipient address
     * @param encryptedAmount Encrypted amount handle
     * @param inputProof Proof for the encrypted input
     * @return transferred The amount actually transferred (encrypted)
     */
    function confidentialMint(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external onlyOwner returns (euint64 transferred) {
        return _mint(to, FHE.fromExternal(encryptedAmount, inputProof));
    }

    /**
     * @notice Burns tokens with a clear amount (owner only)
     * @param from Address to burn from
     * @param amount Amount to burn (in clear)
     */
    function burn(address from, uint64 amount) external onlyOwner {
        _burn(from, FHE.asEuint64(amount));
    }

    /**
     * @notice Burns tokens with an encrypted amount (owner only)
     * @param from Address to burn from
     * @param encryptedAmount Encrypted amount handle
     * @param inputProof Proof for the encrypted input
     * @return transferred The amount actually burned (encrypted)
     */
    function confidentialBurn(
        address from,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external onlyOwner returns (euint64 transferred) {
        return _burn(from, FHE.fromExternal(encryptedAmount, inputProof));
    }

    /**
     * @notice Allows owner to view total supply
     * @dev Grants owner permission to decrypt total supply after each update
     */
    function _update(
        address from,
        address to,
        euint64 amount
    ) internal virtual override returns (euint64 transferred) {
        transferred = super._update(from, to, amount);
        FHE.allow(confidentialTotalSupply(), owner());
    }
}

```

{% endtab %}

{% tab title="ERC7984Example.ts" %}

```typescript
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

```

{% endtab %}

{% endtabs %}
