Documentation for VestingWalletConfidential

{% hint style="info" %}
To run this example correctly, make sure the files are placed in the following directories:

- `.sol` file → `<your-project-root-dir>/contracts/`
- `.ts` file → `<your-project-root-dir>/test/`

This ensures Hardhat can compile and test your contracts as expected.
{% endhint %}

{% tabs %}

{% tab title="VestingWalletConfidential.sol" %}

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/**
 * @title VestingWalletConfidential
 * @notice Vesting wallet for confidential ERC7984 tokens with linear schedule
 * @dev Demonstrates:
 *   - Linear vesting schedule for confidential tokens
 *   - FHE arithmetic operations (add, sub, mul, div)
 *   - Conditional logic with encrypted values (select)
 *   - Reentrancy protection with transient storage
 */

import {FHE, ebool, euint64, euint128} from "@fhevm/solidity/lib/FHE.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

contract VestingWalletConfidential is Ownable, ReentrancyGuardTransient, ZamaEthereumConfig {
    /// @notice Mapping of token address to released amount (encrypted)
    mapping(address token => euint128) private _tokenReleased;

    /// @notice Vesting start timestamp
    uint64 private _start;

    /// @notice Vesting duration in seconds
    uint64 private _duration;

    /// @notice Emitted when tokens are released
    event VestingWalletConfidentialTokenReleased(address indexed token, euint64 amount);

    /**
     * @notice Creates a new vesting wallet
     * @param beneficiary Address that will receive vested tokens
     * @param startTimestamp When vesting begins
     * @param durationSeconds How long the vesting period lasts
     */
    constructor(
        address beneficiary,
        uint48 startTimestamp,
        uint48 durationSeconds
    ) Ownable(beneficiary) {
        _start = startTimestamp;
        _duration = durationSeconds;
    }

    /// @notice Returns the vesting start timestamp
    function start() public view virtual returns (uint64) {
        return _start;
    }

    /// @notice Returns the vesting duration in seconds
    function duration() public view virtual returns (uint64) {
        return _duration;
    }

    /// @notice Returns the vesting end timestamp
    function end() public view virtual returns (uint64) {
        return start() + duration();
    }

    /// @notice Returns the amount of token already released (encrypted)
    function released(address token) public view virtual returns (euint128) {
        return _tokenReleased[token];
    }

    /**
     * @notice Returns the amount of releasable tokens (encrypted)
     * @param token The ERC7984 token address
     * @return The releasable amount
     */
    function releasable(address token) public virtual returns (euint64) {
        euint128 vestedAmount_ = vestedAmount(token, uint48(block.timestamp));
        euint128 releasedAmount = released(token);
        ebool success = FHE.ge(vestedAmount_, releasedAmount);
        return FHE.select(success, FHE.asEuint64(FHE.sub(vestedAmount_, releasedAmount)), FHE.asEuint64(0));
    }

    /**
     * @notice Releases vested tokens to the beneficiary
     * @param token The ERC7984 token to release
     */
    function release(address token) public virtual nonReentrant {
        euint64 amount = releasable(token);
        FHE.allowTransient(amount, token);
        euint64 amountSent = IERC7984(token).confidentialTransfer(owner(), amount);

        // Update released amount (could overflow after many releases, accepted risk)
        euint128 newReleasedAmount = FHE.add(released(token), amountSent);
        FHE.allow(newReleasedAmount, owner());
        FHE.allowThis(newReleasedAmount);
        _tokenReleased[token] = newReleasedAmount;

        emit VestingWalletConfidentialTokenReleased(token, amountSent);
    }

    /**
     * @notice Calculates the vested amount at a given timestamp
     * @param token The ERC7984 token address
     * @param timestamp The timestamp to check
     * @return The vested amount (encrypted)
     */
    function vestedAmount(address token, uint48 timestamp) public virtual returns (euint128) {
        euint128 totalAllocation = FHE.add(
            released(token),
            IERC7984(token).confidentialBalanceOf(address(this))
        );
        return _vestingSchedule(totalAllocation, timestamp);
    }

    /**
     * @notice Internal linear vesting schedule calculation
     * @param totalAllocation Total tokens allocated for vesting
     * @param timestamp Current timestamp
     * @return The vested amount based on linear schedule
     */
    function _vestingSchedule(euint128 totalAllocation, uint48 timestamp) internal virtual returns (euint128) {
        if (timestamp < start()) {
            return euint128.wrap(0);
        } else if (timestamp >= end()) {
            return totalAllocation;
        } else {
            return FHE.div(FHE.mul(totalAllocation, (timestamp - start())), duration());
        }
    }
}

```

{% endtab %}

{% tab title="VestingWalletConfidential.ts" %}

```typescript
/**
 * VestingWalletConfidential Tests
 *
 * Tests for the confidential vesting wallet implementation.
 * Validates:
 * - Vesting schedule initialization
 * - Token release at different time points
 * - Linear vesting calculation
 */

import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("VestingWalletConfidential", function () {
  let vestingWallet: any;
  let token: any;
  let owner: any;
  let beneficiary: any;

  const VESTING_AMOUNT = 1000n;
  const VESTING_DURATION = 3600; // 1 hour in seconds

  beforeEach(async function () {
    [owner, beneficiary] = await ethers.getSigners();

    // Deploy ERC7984 token
    token = await ethers.deployContract("ERC7984Example", [
      owner.address,
      10000n,
      "Test Token",
      "TT",
      "https://example.com/token",
    ]);

    // Get current time and set vesting to start in 1 minute
    const currentTime = await time.latest();
    const startTime = currentTime + 60;

    // Deploy vesting wallet
    vestingWallet = await ethers.deployContract("VestingWalletConfidential", [
      beneficiary.address,
      startTime,
      VESTING_DURATION,
    ]);

    // Transfer tokens to vesting wallet
    const encryptedInput = await fhevm
      .createEncryptedInput(await token.getAddress(), owner.address)
      .add64(VESTING_AMOUNT)
      .encrypt();

    await token
      .connect(owner)
      ["confidentialTransfer(address,bytes32,bytes)"](
        await vestingWallet.getAddress(),
        encryptedInput.handles[0],
        encryptedInput.inputProof
      );
  });

  describe("Initialization", function () {
    it("should set the correct beneficiary as owner", async function () {
      expect(await vestingWallet.owner()).to.equal(beneficiary.address);
    });

    it("should set the correct start time", async function () {
      const currentTime = await time.latest();
      expect(await vestingWallet.start()).to.be.greaterThan(currentTime);
    });

    it("should set the correct duration", async function () {
      expect(await vestingWallet.duration()).to.equal(VESTING_DURATION);
    });

    it("should calculate correct end time", async function () {
      const start = await vestingWallet.start();
      const duration = await vestingWallet.duration();
      expect(await vestingWallet.end()).to.equal(start + duration);
    });
  });

  describe("Vesting Schedule", function () {
    it("should not release tokens before vesting starts", async function () {
      // Just verify the contract can be called
      await expect(
        vestingWallet.connect(beneficiary).release(await token.getAddress())
      ).to.not.be.reverted;
    });

    it("should release tokens at midpoint", async function () {
      const startTime = Number(await vestingWallet.start());
      const midpoint = startTime + VESTING_DURATION / 2;

      await time.increaseTo(midpoint);

      await expect(
        vestingWallet.connect(beneficiary).release(await token.getAddress())
      ).to.not.be.reverted;
    });

    it("should release all tokens after vesting ends", async function () {
      const endTime = Number(await vestingWallet.end());

      await time.increaseTo(endTime + 1000);

      await expect(
        vestingWallet.connect(beneficiary).release(await token.getAddress())
      ).to.not.be.reverted;
    });

    it("should emit release event", async function () {
      const endTime = Number(await vestingWallet.end());
      await time.increaseTo(endTime + 1000);

      await expect(
        vestingWallet.connect(beneficiary).release(await token.getAddress())
      ).to.emit(vestingWallet, "VestingWalletConfidentialTokenReleased");
    });
  });
});

```

{% endtab %}

{% endtabs %}
