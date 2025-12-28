# FHEVM Examples Generator

A comprehensive system for creating standalone FHEVM (Fully Homomorphic Encryption Virtual Machine) example repositories with automated documentation generation.

## | Project Overview

This project provides tools and examples for building privacy-preserving smart contracts using FHEVM by Zama. It includes:

- **Base Template**: A complete Hardhat setup for FHEVM development
- **Example Contracts**: Categorized collection of FHEVM examples
- **Automation Tools**: Scripts to generate standalone repositories and documentation
- **Documentation**: GitBook-formatted guides for each example

## | Quick Start

### 🎯 Interactive CLI (Recommended)

```bash
# Launch interactive menu
npm run cli
```

The interactive CLI provides a user-friendly menu to:
- Create single example projects
- Create category projects with multiple examples
- Generate documentation
- List all available examples

### ⚡ Quick Commands (Non-Interactive)

```bash
# Create a single example
npm run cli:create <example-name> [output-dir]
npm run cli:create fhe-counter ./my-project

# Create a category project
npm run cli:category <category-name> [output-dir]
npm run cli:category basic ./my-basic-examples

# Generate documentation
npm run cli:docs [example-name|--all]
npm run cli:docs fhe-counter
npm run cli:docs --all

# Scan contracts and auto-update config
npm run cli:scan

# List all examples
npm run cli:list
```

### 🔍 Auto-Scan Feature

The `cli:scan` command automatically discovers contracts and tests, updating `examples-config.json`:

```bash
npm run cli:scan
```

**What it does:**
- Scans all `.sol` files in `contracts/` directory
- Finds matching test files automatically
- Updates `examples-config.json` with new examples
- Auto-detects categories based on folder structure
- Generates docs configuration
- Warns about missing descriptions

**After scanning:**
1. Check the warnings for examples needing descriptions
2. Edit `examples-config.json` to fill in missing descriptions
3. Add category names/descriptions if needed

**Example workflow:**
```bash
# 1. Add new contract and test
# contracts/my-category/MyContract.sol
# test/my-category/MyContract.ts

# 2. Run scan
npm run cli:scan

# 3. Fill in descriptions in examples-config.json
# 4. Done! Your example is ready to use
```

## | Project Structure

```
z-hub/
├── base-template/          # Base Hardhat template (submodule)
│   ├── contracts/          # Empty (filled by generator)
│   ├── test/               # Empty (filled by generator)
│   ├── deploy/             # Deployment scripts
│   └── hardhat.config.ts   # Hardhat configuration
│
├── contracts/              # All example contracts (source)
│   ├── basic/              # Basic FHE operations
│   ├── auctions/           # Auction examples
│   ├── openzeppelin-*/     # Token examples
│   └── ...                 # More examples
│
├── test/                   # All test files (mirrors contracts/)
│
├── scripts/                # CLI and automation tools
│   ├── cli.ts              # Main CLI interface
│   ├── scan.ts             # Auto-discovery tool
│   ├── create-fhevm-example.ts
│   ├── create-fhevm-category.ts
│   └── generate-docs.ts
│
├── examples-config.json    # Central configuration
└── README.md               # This file
```

## | Available Examples

### Basic Examples
- **fhe-counter** - Simple encrypted counter demonstrating FHE basics
- **encrypt-single-value** - FHE encryption mechanism and common pitfalls
- **encrypt-multiple-values** - Handling multiple encrypted values
- **user-decrypt-single-value** - User decryption with permission requirements
- **user-decrypt-multiple-values** - Decrypting multiple values
- **fhe-add** - FHE addition operations
- **fhe-if-then-else** - Conditional operations on encrypted values

### Advanced Examples
- **blind-auction** - Sealed-bid auction with confidential bids
- **confidential-dutch-auction** - Dutch auction with encrypted prices

### OpenZeppelin Integration
- **erc7984-example** - Confidential token standard implementation

## | Core Concepts

### FHEVM Encryption Model

FHEVM uses encryption binding where values are bound to `[contract, user]` pairs:

1. **Encryption Binding**: Values encrypted locally, bound to specific contract/user
2. **Input Proofs**: Zero-knowledge proofs attest correct binding
3. **Permission System**: Both contract and user need FHE permissions


## | Adding New Examples

### Quick Method (Recommended)

1. **Create your contract and test:**
   ```
   contracts/my-category/MyContract.sol
   test/my-category/MyContract.ts
   ```

2. **Run auto-scan:**
   ```bash
   npm run cli:scan
   ```

3. **Fill in descriptions:**
   - Open `examples-config.json`
   - Add description for your new example
   - Add category name/description if it's a new category

4. **Test it:**
   ```bash
   npm run cli:create my-contract ./test-output
   cd test-output
   npm install && npm test
   ```

That's it! Your example is ready to use.

### Manual Method

If you prefer manual configuration, edit `examples-config.json` directly:

```json
{
  "examples": {
    "my-example": {
      "contract": "contracts/my-category/MyContract.sol",
      "test": "test/my-category/MyContract.ts",
      "description": "Your description here"
    }
  }
}
```

## | CLI Commands Reference

All commands use the modern CLI interface:

```bash
npm run cli              # Interactive menu
npm run cli:create       # Create example project
npm run cli:category     # Create category project
npm run cli:docs         # Generate documentation
npm run cli:list         # List all examples
npm run cli:scan         # Auto-discover contracts
npm run help             # Show help
```

## | Configuration

### examples-config.json

Central configuration file containing:
- **examples**: All available examples with contract/test paths
- **categories**: Grouped examples by category
- **docs**: Documentation generation settings

This file is automatically updated by `npm run cli:scan`.

## | Resources

- **FHEVM Docs**: https://docs.zama.ai/fhevm
- **Protocol Examples**: https://docs.zama.org/protocol/examples
- **Base Template**: https://github.com/zama-ai/fhevm-hardhat-template
- **Live dApps**: https://github.com/zama-ai/dapps
- **OpenZeppelin Confidential**: https://github.com/OpenZeppelin/openzeppelin-confidential-contracts


## | Contributing

Contributions are welcome! To add a new example:

1. Create contract in `contracts/<category>/YourContract.sol`
2. Create test in `test/<category>/YourContract.ts`
3. Run `npm run cli:scan`
4. Fill in the description in `examples-config.json`
5. Test with `npm run cli:create your-contract ./test`
6. Submit a pull request
