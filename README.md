# FHEVM Examples Generator

A comprehensive system for creating standalone FHEVM (Fully Homomorphic Encryption Virtual Machine) example repositories with automated documentation generation.

## Project Overview

This project provides tools and examples for building privacy-preserving smart contracts using FHEVM by Zama. It includes:

- **Base Template**: A complete Hardhat setup for FHEVM development
- **Example Contracts**: Categorized collection of FHEVM examples
- **Automation Tools**: Scripts to generate standalone repositories and documentation
- **Documentation**: GitBook-formatted guides for each example

## Quick Start

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
npm run cli-create <example-name> [output-dir]
npm run cli-create fhe-counter ./my-project

# Create a category project
npm run cli-category <category-name> [output-dir]
npm run cli-category basic ./my-basic-examples

# Generate documentation
npm run cli-docs [example-name|--all]
npm run cli-docs fhe-counter
npm run cli-docs --all

# List all examples
npm run cli-list
```

## Project Structure

```
z-hub/
├── base-template/               # Base Hardhat template (submodule)
│   ├── contracts/               # Template contract (FHECounter)
│   ├── test/                    # Template tests
│   ├── deploy/                  # Deployment scripts
│   ├── hardhat.config.ts        # Hardhat configuration
│   └── package.json             # Dependencies
│
├── contracts/                   # All example contracts (source)
│   ├── basic/                   # Basic FHE operations
│   │   ├── FHECounter.sol
│   │   ├── encrypt/             # Encryption examples
│   │   ├── decrypt/             # Decryption examples
│   │   └── fhe-operations/      # FHE operators (add, sub, etc.)
│   ├── auctions/                # Auction examples
│   ├── openzeppelin-confidential-contracts/  # ERC7984, tokens
│   └── fheWordle/               # Game example
│
├── test/                        # All test files (mirrors contracts/)
│   ├── basic/
│   ├── blindAuction/
│   └── ...
│
├── examples/                    # Generated GitBook documentation
│   ├── SUMMARY.md               # Documentation index
│   └── *.md                     # Individual example docs
│
├── scripts/                     # Automation tools
│   ├── create-fhevm-example.js  # Repository generator
│   ├── generate-docs.js         # Documentation generator
│   └── README.md                # Scripts documentation
│
├── CLAUDE.md                    # Claude Code guidance
└── README.md                    # This file
```

## Available Examples

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

## Core Concepts

### FHEVM Encryption Model

FHEVM uses encryption binding where values are bound to `[contract, user]` pairs:

1. **Encryption Binding**: Values encrypted locally, bound to specific contract/user
2. **Input Proofs**: Zero-knowledge proofs attest correct binding
3. **Permission System**: Both contract and user need FHE permissions

### Critical Patterns

**✅ DO: Grant Both Permissions**
```solidity
FHE.allowThis(encryptedValue);        // Contract permission
FHE.allow(encryptedValue, msg.sender); // User permission
```

**❌ DON'T: Forget allowThis**
```solidity
FHE.allow(encryptedValue, msg.sender); // Missing allowThis - will fail!
```

**✅ DO: Match Encryption Signer**
```typescript
const enc = await fhevm.createEncryptedInput(contractAddr, alice.address)
    .add32(123).encrypt();
await contract.connect(alice).operate(enc.handles[0], enc.inputProof);
```

**❌ DON'T: Mismatch Signer**
```typescript
const enc = await fhevm.createEncryptedInput(contractAddr, alice.address)
    .add32(123).encrypt();
await contract.connect(bob).operate(enc.handles[0], enc.inputProof); // Fails!
```

## Development Workflow

### Creating a New Example

1. **Write Contract** in `contracts/<category>/YourExample.sol`
   - Include detailed comments explaining FHE concepts
   - Show both correct usage and common pitfalls

2. **Write Tests** in `test/<category>/YourExample.ts`
   - Include success and failure cases
   - Use ✅/❌ markers for clarity
   - Add explanatory comments

3. **Update Script Configurations**
   - Add to `EXAMPLES_MAP` in `scripts/create-fhevm-example.js`
   - Add to `EXAMPLES_CONFIG` in `scripts/generate-docs.js`

4. **Generate Documentation**
   ```bash
   node scripts/generate-docs.js your-example
   ```

5. **Test Standalone Repository**
   ```bash
   node scripts/create-fhevm-example.js your-example ./test-output
   cd test-output
   npm install && npm run compile && npm run test
   ```

### Testing in the Base Template

```bash
cd base-template/

# Copy your contract and test
cp ../contracts/basic/YourExample.sol contracts/
cp ../test/basic/YourExample.ts test/

# Test
npm run compile
npm run test
npm run lint
```

## Automation Tools

### create-fhevm-example.js

Generates complete standalone repositories for **single examples**:
- Clones base template
- Copies contract and test files
- Updates configuration
- Generates README
- Creates deployment scripts

[See scripts/README.md for details](scripts/README.md)

### create-fhevm-category.js

Generates projects with **multiple examples from a category**:
- Copies all contracts from a category (basic, auctions, etc.)
- Includes all corresponding tests
- Generates unified deployment script
- Creates comprehensive README
- Perfect for learning multiple related concepts

**Categories:**
- **basic** (9 contracts) - Encryption, decryption, FHE operations
- **auctions** (2 contracts) - Blind auction, Dutch auction
- **openzeppelin** (4 contracts) - ERC7984, token wrappers, swaps
- **games** (2 contracts) - FHEWordle

[See scripts/README.md for details](scripts/README.md)

### generate-docs.js

Creates GitBook documentation:
- Extracts contract/test code
- Generates formatted markdown
- Updates SUMMARY.md index
- Organizes by category

[See scripts/README.md for details](scripts/README.md)

## Key Dependencies

- `@fhevm/solidity` (v0.9.1) - Core FHEVM Solidity library
- `@fhevm/hardhat-plugin` (v0.3.0-1) - FHEVM testing integration
- `@zama-fhe/relayer-sdk` - Decryption relayer SDK
- `hardhat-deploy` - Deployment management
- `encrypted-types` - TypeScript encrypted type support

## Resources

- **FHEVM Docs**: https://docs.zama.ai/fhevm
- **Protocol Examples**: https://docs.zama.org/protocol/examples
- **Base Template**: https://github.com/zama-ai/fhevm-hardhat-template
- **Live dApps**: https://github.com/zama-ai/dapps
- **OpenZeppelin Confidential**: https://github.com/OpenZeppelin/openzeppelin-confidential-contracts

## Maintenance

### Updating Dependencies

When `@fhevm/solidity` releases a new version:

1. **Update Base Template**
   ```bash
   cd fhevm-hardhat-template/
   npm install @fhevm/solidity@latest
   npm run compile
   npm run test
   ```

2. **Test All Examples**
   - Regenerate a few key examples
   - Ensure they compile and pass tests
   - Update if breaking changes exist

3. **Update Documentation**
   - Regenerate docs if APIs changed
   - Update CLAUDE.md with new patterns

### Bulk Operations

```bash
# Regenerate all documentation
node scripts/generate-docs.js --all

# Test multiple examples
for example in fhe-counter encrypt-single-value user-decrypt-single-value; do
  node scripts/create-fhevm-example.js $example ./test-output/$example
  cd ./test-output/$example && npm install && npm test && cd ../..
done
```

## Contributing

Contributions are welcome! When adding examples:

1. Follow existing patterns and structure
2. Include comprehensive comments in code
3. Demonstrate both correct and incorrect usage
4. Update both automation scripts
5. Test generated standalone repository
6. Verify documentation renders correctly

## License

BSD-3-Clause-Clear License - See LICENSE file

---

**Built with ❤️ using [FHEVM](https://github.com/zama-ai/fhevm) by Zama**
