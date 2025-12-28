#!/usr/bin/env ts-node

/**
 * scan - Automatically scan contracts and tests, update examples-config.json
 *
 * Usage: npm run cli:scan
 */

import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";

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

  return {
    title: contractName.replace(/([A-Z])/g, " $1").trim(),
    description: `Documentation for ${contractName}`,
    output: `docs/${exampleKey}.md`,
    category: categoryName,
  };
}

// Main scan function
function scanExamples(): void {
  const rootDir = path.resolve(__dirname, "..");
  const configPath = path.join(rootDir, "examples-config.json");

  console.log(chalk.cyan.bold("\n🔍 Scanning for contracts and tests...\n"));

  // Load existing config
  let config: Config;
  try {
    const configContent = fs.readFileSync(configPath, "utf-8");
    config = JSON.parse(configContent);
  } catch {
    console.log(
      chalk.yellow("⚠️  examples-config.json not found, creating new one...")
    );
    config = { examples: {}, categories: {}, docs: {} };
  }

  // Find all contracts
  const contractsDir = path.join(rootDir, "contracts");
  const contractFiles = findSolFiles(contractsDir, rootDir);

  console.log(chalk.blue(`Found ${contractFiles.length} contract files\n`));

  let newCount = 0;
  let updatedCount = 0;
  let missingTests = 0;
  const needsDescription: string[] = [];

  for (const contractPath of contractFiles) {
    const contractName = getContractName(path.join(rootDir, contractPath));
    if (!contractName) {
      console.log(
        chalk.yellow(`⚠️  Could not extract contract name from ${contractPath}`)
      );
      continue;
    }

    const exampleKey = contractNameToKey(contractName);
    const testPath = findTestFile(contractPath, rootDir);

    if (!testPath) {
      console.log(
        chalk.red(`❌ No test found for ${contractName} (${contractPath})`)
      );
      missingTests++;
      continue;
    }

    const fixturePath = findFixtureFile(testPath, rootDir);

    // Check if example already exists
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
        console.log(chalk.yellow(`📝 Updated: ${exampleKey}`));
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
      console.log(chalk.green(`✅ Added: ${exampleKey}`));

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
          console.log(chalk.blue(`  → Added to category: ${category}`));
        }
      }

      // Auto-generate docs config if not exists
      if (!config.docs[exampleKey]) {
        config.docs[exampleKey] = generateDocsConfig(
          exampleKey,
          contractName,
          contractPath
        );
        console.log(chalk.blue(`  → Generated docs config`));
      }
    }
  }

  // Save updated config
  // Summary
  console.log(chalk.cyan.bold("\n" + "=".repeat(60)));
  console.log(chalk.cyan.bold("Scan Complete!"));
  console.log(chalk.cyan.bold("=".repeat(60) + "\n"));

  console.log(chalk.white(`Total contracts: ${contractFiles.length}`));
  console.log(chalk.green(`✅ New examples added: ${newCount}`));
  console.log(chalk.yellow(`📝 Examples updated: ${updatedCount}`));
  console.log(chalk.red(`❌ Missing tests: ${missingTests}`));

  // Warn about missing descriptions
  if (needsDescription.length > 0) {
    console.log(chalk.yellow.bold("\n⚠️  Examples needing descriptions:\n"));
    needsDescription.forEach((key) => {
      console.log(chalk.yellow(`  • ${key}`));
    });
    console.log(
      chalk.white(
        "\nPlease edit examples-config.json and add descriptions for these examples.\n"
      )
    );
  } else {
    console.log(chalk.green("\n✅ All examples have descriptions!\n"));
  }

  // Check categories for missing name/description
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
      chalk.yellow.bold("⚠️  Categories needing name/description:\n")
    );
    categoriesNeedingInfo.forEach((key) => {
      console.log(chalk.yellow(`  • ${key}`));
    });
    console.log(
      chalk.white(
        "\nPlease edit examples-config.json and add name/description for these categories.\n"
      )
    );
  }
}

// Run scan
scanExamples();
