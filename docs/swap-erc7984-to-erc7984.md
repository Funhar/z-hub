Documentation for SwapERC7984ToERC7984

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="SwapERC7984ToERC7984.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/**
 * @title SwapERC7984ToERC7984
 * @notice Swaps between two confidential ERC7984 tokens
 * @dev Demonstrates:
 *   - Confidential-to-confidential token swaps
 *   - Transient FHE allowances for multi-contract operations
 *   - Operator pattern for token approvals
 */

import {FHE, externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

contract SwapERC7984ToERC7984 {
    /**
     * @notice Swaps confidential tokens between two ERC7984 contracts
     * @dev Requires this contract to be an operator for the sender on fromToken
     * @param fromToken The source confidential token
     * @param toToken The destination confidential token
     * @param amountInput Encrypted amount handle
     * @param inputProof Proof for the encrypted input
     */
    function swapConfidentialForConfidential(
        IERC7984 fromToken,
        IERC7984 toToken,
        externalEuint64 amountInput,
        bytes calldata inputProof
    ) public virtual {
        // Verify this contract is an approved operator
        require(fromToken.isOperator(msg.sender, address(this)), "Not an operator");

        // Convert external input to euint64
        euint64 amount = FHE.fromExternal(amountInput, inputProof);

        // Transfer from sender to this contract
        FHE.allowTransient(amount, address(fromToken));
        euint64 amountTransferred = fromToken.confidentialTransferFrom(msg.sender, address(this), amount);

        // Transfer to sender from this contract's toToken balance
        FHE.allowTransient(amountTransferred, address(toToken));
        toToken.confidentialTransfer(msg.sender, amountTransferred);
    }
}

```

{% endtab %}

{% tab title="SwapERC7984ToERC7984.ts" %}

```typescript
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

```

{% endtab %}

{% endtabs %}
