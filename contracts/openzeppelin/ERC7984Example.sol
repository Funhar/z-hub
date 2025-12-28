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
