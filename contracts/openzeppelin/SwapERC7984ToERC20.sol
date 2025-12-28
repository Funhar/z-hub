// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

/**
 * @title SwapERC7984ToERC20
 * @notice Swaps confidential ERC7984 tokens to standard ERC20 tokens
 * @dev Demonstrates:
 *   - Confidential to clear token conversion using public decryption
 *   - FHE.makePubliclyDecryptable pattern for off-chain decryption
 *   - Safe token transfer handling
 */

import {FHE, externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract SwapERC7984ToERC20 is ZamaEthereumConfig {
    /// @notice Error thrown when finalization is invalid
    error SwapERC7984ToERC20InvalidFinalization(euint64 amount);

    /// @notice Mapping from encrypted amount handle to receiver address
    mapping(euint64 amount => address) private _receivers;

    /// @notice The confidential token to swap from
    IERC7984 private _fromToken;

    /// @notice The ERC20 token to swap to
    IERC20 private _toToken;

    /// @notice Emitted when a swap is initiated
    event SwapInitiated(address indexed sender, euint64 amount);

    /// @notice Emitted when a swap is finalized
    event SwapFinalized(address indexed receiver, uint64 amount);

    /**
     * @notice Creates a new swap contract
     * @param fromToken_ The confidential ERC7984 token
     * @param toToken_ The standard ERC20 token
     */
    constructor(IERC7984 fromToken_, IERC20 toToken_) {
        _fromToken = fromToken_;
        _toToken = toToken_;
    }

    /**
     * @notice Initiates a swap from ERC7984 to ERC20
     * @dev Transfers confidential tokens and makes amount publicly decryptable
     * @param encryptedInput Encrypted amount handle
     * @param inputProof Proof for the encrypted input
     */
    function swapConfidentialToERC20(externalEuint64 encryptedInput, bytes calldata inputProof) public {
        euint64 amount = FHE.fromExternal(encryptedInput, inputProof);
        FHE.allowTransient(amount, address(_fromToken));
        euint64 amountTransferred = _fromToken.confidentialTransferFrom(msg.sender, address(this), amount);

        // Make the amount publicly decryptable for off-chain processing
        FHE.makePubliclyDecryptable(amountTransferred);

        // Register who will receive the tokens
        _receivers[amountTransferred] = msg.sender;

        emit SwapInitiated(msg.sender, amountTransferred);
    }

    /**
     * @notice Finalizes the swap after off-chain decryption
     * @dev Called after the amount has been decrypted off-chain
     * @param amount The encrypted amount handle
     * @param amountCleartext The decrypted clear amount
     * @param decryptionProof Proof from the decryption oracle
     */
    function finalizeSwap(
        euint64 amount,
        uint64 amountCleartext,
        bytes calldata decryptionProof
    ) public {
        address to = _receivers[amount];
        if (to == address(0)) {
            revert SwapERC7984ToERC20InvalidFinalization(amount);
        }

        // Verify the decryption proof
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(amount);
        FHE.checkSignatures(cts, abi.encode(amountCleartext), decryptionProof);

        // Clear the receiver mapping
        delete _receivers[amount];

        // Transfer ERC20 tokens to the receiver
        if (amountCleartext != 0) {
            SafeERC20.safeTransfer(_toToken, to, amountCleartext);
        }

        emit SwapFinalized(to, amountCleartext);
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

// ============== Mock Contracts for Testing ==============

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title ERC20Mock
 * @notice Simple ERC20 token for testing
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

/**
 * @title ERC7984Mock
 * @notice Simple ERC7984 token for testing SwapERC7984ToERC20
 */
contract ERC7984Mock is ERC7984, ZamaEthereumConfig {
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
