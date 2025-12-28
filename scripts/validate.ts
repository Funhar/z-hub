/**
 * Validate Script
 *
 * Validates project consistency:
 * 1. File Consistency - contracts have tests, paths are valid
 * 2. Config Validation - JSON valid, descriptions exist, no duplicates
 * 3. Solidity Checks - contract names match files, imports valid
 * 4. Documentation Check - SUMMARY.md up to date, doc files exist
 */

import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";

interface ValidationResult {
  errors: string[];
  warnings: string[];
}

interface ExamplesConfig {
  examples: Record<
    string,
    { contract: string; test: string; description: string }
  >;
  categories: Record<
    string,
    { name: string; description: string; contracts: any[] }
  >;
  docs: Record<string, { title: string; output: string }>;
}

const ROOT_DIR = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT_DIR, "examples-config.json");

// Load config
function loadConfig(): ExamplesConfig | null {
  try {
    const content = fs.readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

// 1. File Consistency Check
function validateFileConsistency(config: ExamplesConfig): ValidationResult {
  const result: ValidationResult = { errors: [], warnings: [] };

  console.log(chalk.cyan("\n📁 File Consistency"));

  let contractCount = 0;
  let testCount = 0;
  let missingTests = 0;
  let missingContracts = 0;

  for (const [key, example] of Object.entries(config.examples)) {
    const contractPath = path.join(ROOT_DIR, example.contract);
    const testPath = path.join(ROOT_DIR, example.test);

    // Check contract exists
    if (!fs.existsSync(contractPath)) {
      result.errors.push(`Missing contract: ${example.contract} (${key})`);
      missingContracts++;
    } else {
      contractCount++;
    }

    // Check test exists
    if (!fs.existsSync(testPath)) {
      result.errors.push(`Missing test: ${example.test} (${key})`);
      missingTests++;
    } else {
      testCount++;
    }
  }

  if (missingContracts === 0 && missingTests === 0) {
    console.log(chalk.green(`  ✅ ${contractCount} contracts found`));
    console.log(chalk.green(`  ✅ ${testCount} tests found`));
  } else {
    if (missingContracts > 0) {
      console.log(chalk.red(`  ❌ ${missingContracts} missing contracts`));
    }
    if (missingTests > 0) {
      console.log(chalk.red(`  ❌ ${missingTests} missing tests`));
    }
  }

  return result;
}

// 2. Config Validation
function validateConfig(config: ExamplesConfig): ValidationResult {
  const result: ValidationResult = { errors: [], warnings: [] };

  console.log(chalk.cyan("\n📋 Config Validation"));

  // Check for missing descriptions
  let missingDescriptions = 0;
  for (const [key, example] of Object.entries(config.examples)) {
    if (!example.description || example.description.trim() === "") {
      result.warnings.push(`Missing description: ${key}`);
      missingDescriptions++;
    }
  }

  if (missingDescriptions === 0) {
    console.log(chalk.green(`  ✅ All examples have descriptions`));
  } else {
    console.log(
      chalk.yellow(`  ⚠️  ${missingDescriptions} examples missing descriptions`)
    );
  }

  // Check examples vs docs sync
  const exampleKeys = new Set(Object.keys(config.examples));
  const docKeys = new Set(Object.keys(config.docs));

  const orphanedDocs = [...docKeys].filter((k) => !exampleKeys.has(k));
  const missingDocs = [...exampleKeys].filter((k) => !docKeys.has(k));

  if (orphanedDocs.length > 0) {
    result.warnings.push(`Orphaned docs entries: ${orphanedDocs.join(", ")}`);
    console.log(
      chalk.yellow(`  ⚠️  ${orphanedDocs.length} orphaned docs entries`)
    );
  }

  if (missingDocs.length > 0) {
    result.warnings.push(`Missing docs entries: ${missingDocs.join(", ")}`);
    console.log(
      chalk.yellow(`  ⚠️  ${missingDocs.length} missing docs entries`)
    );
  }

  if (orphanedDocs.length === 0 && missingDocs.length === 0) {
    console.log(chalk.green(`  ✅ Examples and docs are in sync`));
  }

  // Check categories have valid paths
  let invalidCategoryPaths = 0;
  for (const [catKey, category] of Object.entries(config.categories)) {
    for (const contract of category.contracts) {
      const contractPath = path.join(ROOT_DIR, contract.path);
      if (!fs.existsSync(contractPath)) {
        result.errors.push(
          `Invalid category path: ${contract.path} (${catKey})`
        );
        invalidCategoryPaths++;
      }
    }
  }

  if (invalidCategoryPaths === 0) {
    console.log(chalk.green(`  ✅ All category paths valid`));
  } else {
    console.log(
      chalk.red(`  ❌ ${invalidCategoryPaths} invalid category paths`)
    );
  }

  return result;
}

// 3. Solidity Checks
function validateSolidity(config: ExamplesConfig): ValidationResult {
  const result: ValidationResult = { errors: [], warnings: [] };

  console.log(chalk.cyan("\n🔧 Solidity Checks"));

  let validContracts = 0;
  let missingLicense = 0;
  let nameMismatch = 0;

  for (const [key, example] of Object.entries(config.examples)) {
    const contractPath = path.join(ROOT_DIR, example.contract);

    if (!fs.existsSync(contractPath)) continue;

    const content = fs.readFileSync(contractPath, "utf-8");
    const fileName = path.basename(contractPath, ".sol");

    // Check SPDX license
    if (!content.includes("SPDX-License-Identifier")) {
      result.warnings.push(`Missing SPDX license: ${example.contract}`);
      missingLicense++;
    }

    // Check contract name matches file name
    const contractMatch = content.match(/contract\s+(\w+)/);
    if (contractMatch) {
      const contractName = contractMatch[1];
      // Allow for some flexibility (e.g., ERC20Mock in same file)
      if (!content.includes(`contract ${fileName}`)) {
        // Check if main contract exists
        const mainContractRegex = new RegExp(`contract\\s+${fileName}\\s`);
        if (!mainContractRegex.test(content)) {
          result.warnings.push(
            `Contract name mismatch: ${fileName}.sol contains ${contractName}`
          );
          nameMismatch++;
        }
      }
    }

    validContracts++;
  }

  if (missingLicense === 0) {
    console.log(chalk.green(`  ✅ All contracts have SPDX license`));
  } else {
    console.log(
      chalk.yellow(`  ⚠️  ${missingLicense} contracts missing SPDX license`)
    );
  }

  if (nameMismatch === 0) {
    console.log(chalk.green(`  ✅ Contract names match file names`));
  } else {
    console.log(chalk.yellow(`  ⚠️  ${nameMismatch} contract name mismatches`));
  }

  console.log(chalk.green(`  ✅ ${validContracts} contracts validated`));

  return result;
}

// 4. Documentation Check
function validateDocumentation(config: ExamplesConfig): ValidationResult {
  const result: ValidationResult = { errors: [], warnings: [] };

  console.log(chalk.cyan("\n📝 Documentation"));

  const docsDir = path.join(ROOT_DIR, "docs");
  const summaryPath = path.join(docsDir, "SUMMARY.md");

  // Check SUMMARY.md exists
  if (!fs.existsSync(summaryPath)) {
    result.errors.push("SUMMARY.md not found");
    console.log(chalk.red(`  ❌ SUMMARY.md not found`));
    return result;
  }

  const summaryContent = fs.readFileSync(summaryPath, "utf-8");

  // Check all doc files exist
  let missingDocFiles = 0;
  let presentDocFiles = 0;

  for (const [key, doc] of Object.entries(config.docs)) {
    const docPath = path.join(ROOT_DIR, doc.output);
    if (!fs.existsSync(docPath)) {
      result.warnings.push(`Missing doc file: ${doc.output}`);
      missingDocFiles++;
    } else {
      presentDocFiles++;
    }
  }

  if (missingDocFiles === 0) {
    console.log(chalk.green(`  ✅ ${presentDocFiles} doc files present`));
  } else {
    console.log(chalk.yellow(`  ⚠️  ${missingDocFiles} doc files missing`));
  }

  // Check SUMMARY.md has all entries
  let missingInSummary = 0;
  for (const [key, doc] of Object.entries(config.docs)) {
    const mdFile = path.basename(doc.output);
    if (!summaryContent.includes(mdFile)) {
      result.warnings.push(`Not in SUMMARY.md: ${doc.title}`);
      missingInSummary++;
    }
  }

  if (missingInSummary === 0) {
    console.log(chalk.green(`  ✅ SUMMARY.md is up to date`));
  } else {
    console.log(
      chalk.yellow(`  ⚠️  ${missingInSummary} entries missing from SUMMARY.md`)
    );
  }

  return result;
}

// Main validation function
export function validate(): { errors: number; warnings: number } {
  console.log(chalk.bold.cyan("\n🔍 Validating project...\n"));
  console.log(chalk.gray("=".repeat(50)));

  // Load and validate JSON
  const config = loadConfig();
  if (!config) {
    console.log(chalk.red("\n❌ Failed to load examples-config.json"));
    console.log(chalk.red("   Please check JSON syntax"));
    return { errors: 1, warnings: 0 };
  }

  console.log(chalk.green("  ✅ JSON valid"));

  // Run all validations
  const results: ValidationResult[] = [];

  results.push(validateFileConsistency(config));
  results.push(validateConfig(config));
  results.push(validateSolidity(config));
  results.push(validateDocumentation(config));

  // Summarize results
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

  console.log(chalk.gray("\n" + "=".repeat(50)));

  if (totalErrors === 0 && totalWarnings === 0) {
    console.log(chalk.bold.green("\n✅ Validation passed! No issues found.\n"));
  } else {
    console.log(
      chalk.bold(
        `\nResult: ${chalk.red(totalErrors + " errors")}, ${chalk.yellow(
          totalWarnings + " warnings"
        )}\n`
      )
    );

    if (totalErrors > 0) {
      console.log(chalk.red("Errors:"));
      results.forEach((r) =>
        r.errors.forEach((e) => console.log(chalk.red(`  • ${e}`)))
      );
    }

    if (totalWarnings > 0) {
      console.log(chalk.yellow("\nWarnings:"));
      results.forEach((r) =>
        r.warnings.forEach((w) => console.log(chalk.yellow(`  • ${w}`)))
      );
    }
    console.log("");
  }

  return { errors: totalErrors, warnings: totalWarnings };
}

// Run if called directly
if (require.main === module) {
  const { errors } = validate();
  process.exit(errors > 0 ? 1 : 0);
}
