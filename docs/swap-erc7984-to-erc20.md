Documentation for SwapERC7984ToERC20

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="SwapERC7984ToERC20.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/**
 * @title SwapERC7984ToERC20
 * @notice Swaps confidential ERC7984 tokens to standard ERC20 tokens
 * @dev Demonstrates:
 *   - Gateway decryption pattern for confidential → clear conversion
 *   - Asynchronous decryption with callback
 *   - Safe token transfer handling
 */

import {FHE, externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

contract SwapERC7984ToERC20 {
    /// @notice Error thrown when a gateway request is invalid
    error SwapERC7984ToERC20InvalidGatewayRequest(uint256 requestId);

    /// @notice Mapping from decryption request ID to receiver address
    mapping(uint256 requestId => address) private _receivers;

    /// @notice The confidential token to swap from
    IERC7984 private _fromToken;

    /// @notice The ERC20 token to swap to
    IERC20 private _toToken;

    /**
     * @notice Creates a new swap contract
     * @param fromToken The confidential ERC7984 token
     * @param toToken The standard ERC20 token
     */
    constructor(IERC7984 fromToken, IERC20 toToken) {
        _fromToken = fromToken;
        _toToken = toToken;
    }

    /**
     * @notice Initiates a swap from ERC7984 to ERC20
     * @dev Transfers confidential tokens and requests decryption
     * @param encryptedInput Encrypted amount handle
     * @param inputProof Proof for the encrypted input
     */
    function swap(externalEuint64 encryptedInput, bytes memory inputProof) public {
        euint64 amount = FHE.fromExternal(encryptedInput, inputProof);
        FHE.allowTransient(amount, address(_fromToken));
        euint64 amountTransferred = _fromToken.confidentialTransferFrom(msg.sender, address(this), amount);

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = euint64.unwrap(amountTransferred);
        uint256 requestID = FHE.requestDecryption(cts, this.finalizeSwap.selector);

        // Register who will receive the tokens
        _receivers[requestID] = msg.sender;
    }

    /**
     * @notice Callback function called by the gateway after decryption
     * @dev Transfers ERC20 tokens to the receiver
     * @param requestID The decryption request ID
     * @param amount The decrypted amount
     * @param signatures Gateway signatures for verification
     */
    function finalizeSwap(uint256 requestID, uint64 amount, bytes[] memory signatures) public virtual {
        FHE.checkSignatures(requestID, signatures);

        address to = _receivers[requestID];
        require(to != address(0), SwapERC7984ToERC20InvalidGatewayRequest(requestID));
        delete _receivers[requestID];

        if (amount != 0) {
            SafeERC20.safeTransfer(_toToken, to, amount);
        }
    }

    /// @notice Returns the source confidential token
    function fromToken() public view returns (IERC7984) {
        return _fromToken;
    }

    /// @notice Returns the destination ERC20 token
    function toToken() public view returns (IERC20) {
        return _toToken;
    }
}

```

{% endtab %}

{% tab title="SwapERC7984ToERC20.ts" %}

```typescript
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

```

{% endtab %}

{% endtabs %}
