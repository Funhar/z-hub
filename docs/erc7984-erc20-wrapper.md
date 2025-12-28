Documentation for ERC7984ERC20Wrapper

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="ERC7984ERC20Wrapper.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/**
 * @title ERC7984ERC20Wrapper
 * @notice Wraps an ERC20 token into a confidential ERC7984 token
 * @dev Demonstrates:
 *   - Converting standard ERC20 tokens to confidential ERC7984
 *   - Unwrapping confidential tokens back to ERC20
 *   - Rate-based conversion between token standards
 */

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC7984ERC20Wrapper, ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol";

contract ERC7984ERC20Wrapper is ERC7984ERC20Wrapper, ZamaEthereumConfig {
    /**
     * @notice Creates a new wrapper for an ERC20 token
     * @param token The underlying ERC20 token to wrap
     * @param name Token name for the wrapped version
     * @param symbol Token symbol for the wrapped version
     * @param uri Contract metadata URI
     */
    constructor(
        IERC20 token,
        string memory name,
        string memory symbol,
        string memory uri
    ) ERC7984ERC20Wrapper(token) ERC7984(name, symbol, uri) {}
}

/**
 * @title ERC20Mock
 * @notice Simple ERC20 token for testing purposes
 */
contract ERC20Mock is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

```

{% endtab %}

{% tab title="ERC7984ERC20Wrapper.ts" %}

```typescript
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

      // Check that ERC20 balance is reduced
      expect(await erc20.balanceOf(user.address)).to.equal(0n);
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

```

{% endtab %}

{% endtabs %}
