Enable private swaps between two confidential ERC7984 tokens. An AMM-style swap where both input and output amounts stay encrypted during the entire trade process.

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
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract SwapERC7984ToERC7984 is ZamaEthereumConfig {
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

/**
 * @title ERC7984Example
 * @notice Simple ERC7984 token for testing SwapERC7984ToERC7984
 */
contract ERC7984Example is ERC7984, ZamaEthereumConfig {
    constructor(
        address initialOwner,
        uint64 initialSupply,
        string memory name,
        string memory symbol,
        string memory uri
    ) ERC7984(name, symbol, uri) {
        _mint(initialOwner, FHE.asEuint64(initialSupply));
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

```

{% endtab %}

{% endtabs %}
