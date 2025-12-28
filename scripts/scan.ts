#!/usr/bin/env ts-node

/**
 * scan - Automatically scan contracts and tests, update examples-config.json
 *
 * Usage: npm run cli:scan
 */

import * as fs from "fs";
import * as path from "path";
import {
  theme,
  zamaGradient,
  createResultBox,
  createWarningBox,
} from "./utils/theme";

interface ExampleConfig {
  contract: string;
  test: string;
  testFixture?: string;
  description: string;
}

interface Config {
  examples: Record<string, ExampleConfig>;
  categories: any;
  docs: any;
}

// Get contract name from file content
function getContractName(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const match = content.match(/^\s*contract\s+(\w+)(?:\s+is\s+|\s*\{)/m);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Convert contract name to example key (e.g., FHECounter -> fhe-counter)
function contractNameToKey(contractName: string): string {
  return contractName
    .replace(/([a-z])([A-Z])/g, "$1-$2") // lowercase followed by uppercase
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

// Find all .sol files recursively
function findSolFiles(dir: string, baseDir: string): string[] {
  const files: string[] = [];

  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findSolFiles(fullPath, baseDir));
    } else if (item.endsWith(".sol")) {
      const relativePath = path.relative(baseDir, fullPath);
      files.push(relativePath);
    }
  }

  return files;
}

// Find matching test file for a contract
function findTestFile(contractPath: string, rootDir: string): string | null {
  const contractName = getContractName(path.join(rootDir, contractPath));
  if (!contractName) return null;

  // Possible test locations
  const testPaths = [
    `test/${contractName}.ts`,
    `test/basic/${contractName}.ts`,
    contractPath.replace("contracts/", "test/").replace(".sol", ".ts"),
  ];

  // Check subdirectories in test/
  const testDir = path.join(rootDir, "test");
  if (fs.existsSync(testDir)) {
    const findTestRecursive = (dir: string): string | null => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          const found = findTestRecursive(fullPath);
          if (found) return found;
        } else if (item === `${contractName}.ts`) {
          return path.relative(rootDir, fullPath);
        }
      }
      return null;
    };

    const found = findTestRecursive(testDir);
    if (found) return found;
  }

  // Check predefined paths
  for (const testPath of testPaths) {
    if (fs.existsSync(path.join(rootDir, testPath))) {
      return testPath;
    }
  }

  return null;
}

// Find fixture file if exists
function findFixtureFile(testPath: string, rootDir: string): string | null {
  const fixturePath = testPath.replace(".ts", ".fixture.ts");
  if (fs.existsSync(path.join(rootDir, fixturePath))) {
    return fixturePath;
  }
  return null;
}

// Detect category from contract path - dynamically based on folder structure
function detectCategory(contractPath: string): string | null {
  // Get the folder path after "contracts/"
  // e.g., "contracts/basic/encrypt/Foo.sol" -> "basic"
  // e.g., "contracts/auctions/BlindAuction.sol" -> "auctions"
  const match = contractPath.match(/^contracts\/([^\/]+)/);
  if (match) {
    return match[1]; // Return first folder name after contracts/
  }
  return null;
}

// Convert folder name to display name
function getCategoryDisplayName(folderName: string): string {
  // Convert kebab-case or snake_case to Title Case
  return folderName
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Generate docs config for an example
function generateDocsConfig(
  exampleKey: string,
  contractName: string,
  contractPath: string
) {
  const category = detectCategory(contractPath);
  const categoryName = category ? getCategoryDisplayName(category) : "Other";

  // Generate title: add space before uppercase letters that follow lowercase
  const title = contractName
    .replace(/([a-z])([A-Z])/g, "$1 $2") // lowercase followed by uppercase
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2"); // acronym followed by word

  return {
    title,
    description: `Documentation for ${contractName}`,
    output: `docs/${exampleKey}.md`,
    category: categoryName,
  };
}

// Main scan function
function scanExamples(): void {
  const rootDir = path.resolve(__dirname, "..");
  const configPath = path.join(rootDir, "examples-config.json");

  console.log(zamaGradient("\n🔍 Scanning for contracts and tests...\n"));

  // Load existing config
  let config: Config;
  try {
    const configContent = fs.readFileSync(configPath, "utf-8");
    config = JSON.parse(configContent);
  } catch {
    console.log(
      theme.warning("⚠️  examples-config.json not found, creating new one...")
    );
    config = { examples: {}, categories: {}, docs: {} };
  }

  // Find all contracts
  const contractsDir = path.join(rootDir, "contracts");
  const contractFiles = findSolFiles(contractsDir, rootDir);

  console.log(theme.info(`Found ${contractFiles.length} contract files\n`));

  let newCount = 0;
  let updatedCount = 0;
  let missingTests = 0;
  const needsDescription: string[] = [];

  for (const contractPath of contractFiles) {
    const contractName = getContractName(path.join(rootDir, contractPath));
    if (!contractName) {
      console.log(
        theme.warning(
          `⚠️  Could not extract contract name from ${contractPath}`
        )
      );
      continue;
    }

    const exampleKey = contractNameToKey(contractName);
    const testPath = findTestFile(contractPath, rootDir);

    if (!testPath) {
      console.log(
        theme.error(`❌ No test found for ${contractName} (${contractPath})`)
      );
      missingTests++;
      continue;
    }

    const fixturePath = findFixtureFile(testPath, rootDir);

    // Check if this contract path already exists with a different key
    const existingEntryByPath = Object.entries(config.examples).find(
      ([, value]) => value.contract === contractPath
    );

    if (existingEntryByPath) {
      const [existingKey] = existingEntryByPath;
      if (existingKey !== exampleKey) {
        // Contract already exists with different key, skip to avoid duplicates
        continue;
      }
    }

    // Check if example already exists by key
    const exists = config.examples[exampleKey];

    if (exists) {
      // Update paths if changed
      let changed = false;
      if (exists.contract !== contractPath) {
        exists.contract = contractPath;
        changed = true;
      }
      if (exists.test !== testPath) {
        exists.test = testPath;
        changed = true;
      }
      if (fixturePath && exists.testFixture !== fixturePath) {
        exists.testFixture = fixturePath;
        changed = true;
      }

      if (changed) {
        updatedCount++;
        console.log(theme.warning(`📝 Updated: ${exampleKey}`));
      }

      // Check if description is empty
      if (!exists.description || exists.description.trim() === "") {
        needsDescription.push(exampleKey);
      }
    } else {
      // Add new example
      config.examples[exampleKey] = {
        contract: contractPath,
        test: testPath,
        description: "", // Empty, user will fill
      };

      if (fixturePath) {
        config.examples[exampleKey].testFixture = fixturePath;
      }

      newCount++;
      needsDescription.push(exampleKey);
      console.log(theme.success(`✅ Added: ${exampleKey}`));

      // Auto-add to category if detected
      const category = detectCategory(contractPath);
      if (category) {
        if (!config.categories[category]) {
          config.categories[category] = {
            name: "",
            description: "",
            contracts: [],
          };
        }

        // Check if contract already in category
        const categoryContracts = config.categories[category].contracts || [];
        const alreadyInCategory = categoryContracts.some(
          (c: any) => c.path === contractPath
        );

        if (!alreadyInCategory) {
          const contractEntry: any = {
            path: contractPath,
            test: testPath,
          };

          if (fixturePath) {
            contractEntry.fixture = fixturePath;
          }

          categoryContracts.push(contractEntry);
          config.categories[category].contracts = categoryContracts;
          console.log(theme.info(`  → Added to category: ${category}`));
        }
      }

      // Auto-generate docs config if not exists
      if (!config.docs[exampleKey]) {
        config.docs[exampleKey] = generateDocsConfig(
          exampleKey,
          contractName,
          contractPath
        );
        console.log(theme.info(`  → Generated docs config`));
      }
    }
  }

  // Save updated config
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

  // Summary
  const summary = [
    `Total contracts: ${theme.bold(contractFiles.length)}`,
    `New examples:    ${theme.success(newCount)}`,
    `Updated:         ${theme.warning(updatedCount)}`,
    `Missing tests:   ${theme.error(missingTests)}`,
  ].join("\n");

  console.log(createResultBox(summary, "🔎 Scan Results", missingTests > 0));

  if (needsDescription.length > 0) {
    console.log(createWarningBox(needsDescription, "⚠️ Missing Descriptions"));
  } else {
    console.log(theme.success("\n✅ All examples have descriptions!\n"));
  }

  const categoriesNeedingInfo: string[] = [];
  for (const [catKey, catValue] of Object.entries(config.categories)) {
    const cat = catValue as any;
    if (
      !cat.name ||
      cat.name.trim() === "" ||
      !cat.description ||
      cat.description.trim() === ""
    ) {
      categoriesNeedingInfo.push(catKey);
    }
  }

  if (categoriesNeedingInfo.length > 0) {
    console.log(
      createWarningBox(categoriesNeedingInfo, "⚠️ Categories Needing Info")
    );
  }
}

// Run scan
scanExamples();
