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
import {ERC7984ERC20Wrapper as ERC7984ERC20WrapperBase, ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol";

contract ConfidentialERC20Wrapper is ERC7984ERC20WrapperBase, ZamaEthereumConfig {
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
    ) ERC7984ERC20WrapperBase(token) ERC7984(name, symbol, uri) {}
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
