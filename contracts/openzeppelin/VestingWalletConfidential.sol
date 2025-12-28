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
