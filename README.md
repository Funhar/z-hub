<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=FFD20A&height=250&section=header&text=Z-Hub&fontSize=80&animation=fadeIn&fontAlignY=35&desc=FHEVM%20Examples%20Generator&descAlignY=55&descAlign=50" />
</p>

<p align="center">
  <a href="https://spdx.org/licenses/BSD-3-Clause-Clear.html"><img src="https://img.shields.io/badge/License-BSD--3--Clause--Clear-blue.svg" alt="License"></a>
  <a href="https://docs.zama.ai/fhevm"><img src="https://img.shields.io/badge/FHEVM-Zama-orange" alt="FHEVM"></a>
  <a href="https://hardhat.org/"><img src="https://img.shields.io/badge/Framework-Hardhat-yellow" alt="Hardhat"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/Language-TypeScript-blue" alt="TypeScript"></a>
</p>

<p align="center">
  <b>A comprehensive system for creating standalone FHEVM example repositories with automated documentation generation.</b>
</p>

## | Architecture & Overview

| 🧩 **The System**                                                 | ⚡ **The Workflow**                                          |
| :--------------------------------------------------------------- | :---------------------------------------------------------- |
| **Modular Library**: Comprehensive collection of FHEVM examples. | **1. Base Template**: Pre-configured Hardhat environment.   |
| **Smart Scaffolding**: Automated project creation from source.   | **2. Contract Injection**: Selectively inject code & tests. |
| **Auto-Documentation**: Instant GitBook-ready guide generation.  | **3. Standalone Output**: Isolated, ready-to-deploy repos.  |


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

# Run tests for specific example
npm run cli:test <example-name>
npm run cli:test fhe-counter
```

### 🧪 Testing Examples

You can test examples directly without creating a standalone project first. The tool will temporarily build the project and run tests.

```bash
# Interactive mode (Select from list)
npm run cli:test

# Direct mode (Run specific test)
npm run cli:test fhe-counter
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

```text
z-hub/
├── base-template/          # Pre-configured Hardhat environment used as scaffolding
├── contracts/              # Source code for all FHEVM example contracts (categorized)
├── test/                   # Comprehensive test suite for all examples (mirrors contracts/)
├── docs/                   # Automatically generated documentation (GitBook format)
├── scripts/                # Core automation motor
│   ├── cli.ts              # Main interactive/non-interactive CLI router
│   ├── scan.ts             # Auto-discovery engine for contracts and tests
│   ├── create-example.ts   # Logic for single example project generation
│   ├── create-category.ts  # Logic for category-based project generation
│   ├── generate-docs.ts    # Documentation generator using contract comments
│   ├── run-tests.ts        # Internal example testing tool
│   ├── validate.ts         # System health and configuration validator
│   ├── utils/              # CLI helpers, common logic and visual themes
│   └── workflows/          # Interactive CLI flow implementations
│
├── examples-config.json    # Central manifest of all examples, categories, and docs
├── package.json            # Project dependencies and script shortcuts
└── README.md               # This file
```

## | Available Examples

### 🧱 Basic Operations
*Foundational building blocks for FHE development.*

| Example ID              | Key Concept     | Description                                     |
| :---------------------- | :-------------- | :---------------------------------------------- |
| **`fhe-counter`**       | Encrypted State | precise state tracking without revealing values |
| **`fhe-add`**           | Arithmetic      | Trustless addition on encrypted integers        |
| **`fhe-sub`**           | Arithmetic      | Secure subtraction of encrypted values          |
| **`fhe-eq`**            | Logic           | Equality checks without decryption              |
| **`fhe-if-then-else`**  | Logic           | Conditional branching using `FHE.select`        |
| **`encrypt-s/m-value`** | I/O             | Best practices for single & batch encryption    |
| **`user-decrypt`**      | Decryption      | User-only data revelation (Permissioned)        |
| **`public-decrypt`**    | Decryption      | Public data revelation (Global visibility)      |

### 🛡️ OpenZeppelin Integration
*Standard-compliant confidential tokens & tools.*

| Example ID                  | Standard | Description                                            |
| :-------------------------- | :------- | :----------------------------------------------------- |
| **`erc7984-example`**       | ERC7984  | Full confidential token implementation                 |
| **`erc7984-erc20-wrapper`** | Wrapper  | Wrap public ERC20s into private tokens                 |
| **`vesting-wallet`**        | Finance  | Private token vesting schedules                        |
| **`swap-erc7984`**          | DeFi     | Swaps between Private-Private or Private-Public tokens |

### 🚀 Advanced Use Cases
*Complex protocols pushing the boundaries of on-chain privacy.*

| Example ID              | Domain  | Description                                    |
| :---------------------- | :------ | :--------------------------------------------- |
| **`blind-auction`**     | Auction | Sealed-bid auction with completely hidden bids |
| **`private-messaging`** | Social  | Secure, on-chain encrypted messaging system    |
| **`anonymous-whistle`** | Social  | Identity-protecting whistleblowing platform    |
| **`fair-dice`**         | Gaming  | Provably fair RNG using encrypted commits      |
| **`secret-tip`**        | Social  | Anonymous financial support & tipping          |

### 🏦 Decentralized Finance (DeFi)
*Privacy-first financial primitives.*

| Example ID          | Primitive  | Description                            |
| :------------------ | :--------- | :------------------------------------- |
| **`dark-pool`**     | Trading    | Private order book & matching engine   |
| **`private-vault`** | Banking    | Confidential asset custody & balances  |
| **`secret-voting`** | Governance | Encrypted DAO voting with public tally |

### 🔬 Deep Dive & Security
*Technical patterns for robust development.*

| Example ID             | Topic     | Description                              |
| :--------------------- | :-------- | :--------------------------------------- |
| **`access-control`**   | Security  | Managing FHE permissions & re-encryption |
| **`input-proofs`**     | Security  | Verifying encrypted input validity       |
| **`handle-lifecycle`** | Internals | Understanding FHE handle storage & scope |
| **`anti-patterns`**    | Security  | Common mistakes and how to avoid them    |

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
npm run cli:test         # Run tests (Interactive/Direct)
npm run cli:validate     # Validate system health
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
