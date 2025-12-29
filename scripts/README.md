# ⚙️ Z-Hub Automation Engine

This directory contains the core logic and scripts that power the FHEVM Example Generator. All scripts are written in **TypeScript** for type safety and maintainability.

---

## | Core Entry Point

### `cli.ts` - The Command Router
This is the primary interface for all Z-Hub operations. It acts as a router, offloading specific tasks up to specialized scripts.

**Usage:**
```bash
# Interactive menu
ts-node scripts/cli.ts

# Command router
ts-node scripts/cli.ts create
ts-node scripts/cli.ts category
```

---

## | Main Automation Scripts

### 1. `scan.ts` - The Discovery Engine
The pulse of the project. It automatically scans the `contracts/` and `test/` directories to detect new examples.
- **Function**: Automatically updates `examples-config.json`.
- **Logic**: Matches `.sol` files with their `.ts` counterparts.
- **Usage**:
  ```bash
  ts-node scripts/scan.ts
  ```

### 2. `create-example.ts` - Smart Scaffolder (Single)
Generates a standalone, ready-to-use Hardhat project for a specific example.
- **Usage**:
  ```bash
  # Plain usage (Interactive via cli selector)
  ts-node scripts/create-example.ts

  # Parameterized usage
  ts-node scripts/create-example.ts fhe-counter ./output/my-fhe-app
  ```

### 3. `create-category.ts` - Smart Scaffolder (Category)
Bundles **all** examples from a specific category into one workspace.
- **Usage**:
  ```bash
  # Plain usage
  ts-node scripts/create-category.ts

  # Parameterized usage
  ts-node scripts/create-category.ts basic ./output/basic-library
  ```

### 4. `generate-docs.ts` - Documentation Engine
Extracts technical details and comments from contracts to generate beautiful GitBook-formatted guides.
- **Usage**:
  ```bash
  # Plain usage (All examples)
  ts-node scripts/generate-docs.ts --all

  # Parameterized usage (Targeted)
  ts-node scripts/generate-docs.ts fhe-counter
  ```

---

## | Utility & Maintenance

### `run-tests.ts` - Example Verifier
An internal tool that validates examples by spinning up ephemeral projects and executing their tests.
- **Usage**:
  ```bash
  # Plain usage (Interactive selector)
  ts-node scripts/run-tests.ts

  # Parameterized usage
  ts-node scripts/run-tests.ts fhe-counter
  ```

### `validate.ts` - System Health Check
Validates the integrity of `examples-config.json` and ensures all referenced files exist.
- **Usage**:
  ```bash
  ts-node scripts/validate.ts
  ```

---

## | Configuration & The Manifest

The `examples-config.json` file in the root directory is the **Source of Truth** for the entire system. Every script relies on this manifest to understand what examples exist and where they are located.

### 🧩 Schema Breakdown

```json
{
  "examples": {
    "fhe-counter": {
      "contract": "path/to/Contract.sol",
      "test": "path/to/Test.ts",
      "description": "Educational summary of the example"
    }
  },
  "categories": {
    "basic": {
      "name": "Display Name",
      "description": "Category overview",
      "contracts": [{ "path": "...", "test": "..." }]
    }
  }
}
```

### 🔄 The Automation Flow

1.  **Detection**: `scan.ts` traverses the filesystem. When it finds a `.sol` / `.ts` pair, it updates the `examples` and `categories` objects.
2.  **Consumption**:
    - `create-example.ts` reads the paths to know what to copy.
    - `generate-docs.ts` uses the `description` for the intro text.
    - `run-tests.ts` uses it to know which tests to execute.

> [!TIP]
> While `scan.ts` handles the heavy lifting of path mapping, human intervention is required to write high-quality **descriptions** in the JSON to ensure the generated documentation remains helpful.

---

## | Infrastructure Structure

```text
scripts/
├── utils/               # Shared logic
│   ├── cli-common.ts    # Reusable CLI helpers (spinners, help menus)
│   └── theme.ts         # Zama-themed visuals (gradients, colors)
│
├── workflows/           # UX Layers
│   └── interactive.ts   # Implementation of the interactive menu flows
│
├── cli.ts               # Main Router
├── scan.ts              # Logic for auto-discovery
├── create-example.ts    # Scaffolding logic (Single)
├── create-category.ts   # Scaffolding logic (Category)
├── generate-docs.ts     # Documentation generator
├── run-tests.ts         # Internal test runner
└── validate.ts          # Config validator
```

---

## 💡 Developer Workflow (CLI Shortcodes)

While you can run scripts directly via `ts-node`, the following `npm` shortcodes are provided for convenience:

1. **Add new code** to `contracts/` and `test/`.
2. **Scan**: `npm run cli:scan`
3. **Describe**: Add a summary to `examples-config.json`.
4. **Verify**: `npm run cli:test <id>`

---

## | Notes for Contributors
- **Config First**: Always use `examples-config.json` rather than hardcoding paths.
- **Base Template**: Run `validate` after changing the template to ensure backward compatibility.
- **Visuals**: Use `utils/theme.ts` for consistent text styling.

---

## 🔍 Troubleshooting

### 1. `scan.ts` doesn't find my new example
The discovery engine expects a matching pair:
- **Contract**: `contracts/category/YourFeature.sol`
- **Test**: `test/category/YourFeature.ts`
If the filenames don't match exactly (case-sensitive), it won't be indexed.

### 2. Generated projects fail to compile/test
- Ensure you have run `npm install` in the **root** folder first.
- Check if your new contract uses experimental features not supported by the current `fhevm` version in `base-template`.
- Run `npm run cli:validate` to catch broken paths early.

### 3. Tests are timing out
FHE compute is intensive. If `run-tests.ts` fails during the "Running tests..." phase, it might be due to the default timeout. The internal runner uses a 5-minute timeout, which should be sufficient for most examples.

### 4. Node.js Version
Ensure you are using **Node.js >= 20**. Use `nvm` if needed:
```bash
nvm use 20
```
