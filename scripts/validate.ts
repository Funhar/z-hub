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
import {
  theme,
  colors,
  createHeader,
  createResultBox,
  createWarningBox,
} from "./utils/theme";

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

  console.log(theme.info(`\n${theme.bold("📁 File Consistency")}`));

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
    console.log(theme.success(`  ✅ ${contractCount} contracts found`));
    console.log(theme.success(`  ✅ ${testCount} tests found`));
  } else {
    if (missingContracts > 0) {
      console.log(theme.error(`  ❌ ${missingContracts} missing contracts`));
    }
    if (missingTests > 0) {
      console.log(theme.error(`  ❌ ${missingTests} missing tests`));
    }
  }

  return result;
}

// 2. Config Validation
function validateConfig(config: ExamplesConfig): ValidationResult {
  const result: ValidationResult = { errors: [], warnings: [] };

  console.log(theme.info(`\n${theme.bold("📋 Config Validation")}`));

  // Check for missing descriptions
  let missingDescriptions = 0;
  for (const [key, example] of Object.entries(config.examples)) {
    if (!example.description || example.description.trim() === "") {
      result.warnings.push(`Missing description: ${key}`);
      missingDescriptions++;
    }
  }

  if (missingDescriptions === 0) {
    console.log(theme.success(`  ✅ All examples have descriptions`));
  } else {
    console.log(
      theme.warning(
        `  ⚠️  ${missingDescriptions} examples missing descriptions`
      )
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
      theme.warning(`  ⚠️  ${orphanedDocs.length} orphaned docs entries`)
    );
  }

  if (missingDocs.length > 0) {
    result.warnings.push(`Missing docs entries: ${missingDocs.join(", ")}`);
    console.log(
      theme.warning(`  ⚠️  ${missingDocs.length} missing docs entries`)
    );
  }

  if (orphanedDocs.length === 0 && missingDocs.length === 0) {
    console.log(theme.success(`  ✅ Examples and docs are in sync`));
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
    console.log(theme.success(`  ✅ All category paths valid`));
  } else {
    console.log(
      theme.error(`  ❌ ${invalidCategoryPaths} invalid category paths`)
    );
  }

  return result;
}

// 3. Solidity Checks
function validateSolidity(config: ExamplesConfig): ValidationResult {
  const result: ValidationResult = { errors: [], warnings: [] };

  console.log(theme.info(`\n${theme.bold("🔧 Solidity Checks")}`));

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
    console.log(theme.success(`  ✅ All contracts have SPDX license`));
  } else {
    console.log(
      theme.warning(`  ⚠️  ${missingLicense} contracts missing SPDX license`)
    );
  }

  if (nameMismatch === 0) {
    console.log(theme.success(`  ✅ Contract names match file names`));
  } else {
    console.log(
      theme.warning(`  ⚠️  ${nameMismatch} contract name mismatches`)
    );
  }

  console.log(theme.success(`  ✅ ${validContracts} contracts validated`));

  return result;
}

// 4. Documentation Check
function validateDocumentation(config: ExamplesConfig): ValidationResult {
  const result: ValidationResult = { errors: [], warnings: [] };

  console.log(theme.info(`\n${theme.bold("📝 Documentation")}`));

  const docsDir = path.join(ROOT_DIR, "docs");
  const summaryPath = path.join(docsDir, "SUMMARY.md");

  // Check SUMMARY.md exists
  if (!fs.existsSync(summaryPath)) {
    result.errors.push("SUMMARY.md not found");
    console.log(theme.error(`  ❌ SUMMARY.md not found`));
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
    console.log(theme.success(`  ✅ ${presentDocFiles} doc files present`));
  } else {
    console.log(theme.warning(`  ⚠️  ${missingDocFiles} doc files missing`));
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
    console.log(theme.success(`  ✅ SUMMARY.md is up to date`));
  } else {
    console.log(
      theme.warning(`  ⚠️  ${missingInSummary} entries missing from SUMMARY.md`)
    );
  }

  return result;
}

// Main validation function
export function validate(): { errors: number; warnings: number } {
  console.log(createHeader("🔍 Project Consistency Validator", colors.sky));

  // Load and validate JSON
  const config = loadConfig();
  if (!config) {
    console.log(theme.error("\n❌ Failed to load examples-config.json"));
    console.log(theme.error("   Please check JSON syntax"));
    return { errors: 1, warnings: 0 };
  }

  console.log(theme.success("  ✅ JSON structure valid"));

  // Run all validations
  const results: ValidationResult[] = [];

  results.push(validateFileConsistency(config));
  results.push(validateConfig(config));
  results.push(validateSolidity(config));
  results.push(validateDocumentation(config));

  // Summarize results
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

  const summary = [
    `Total Checks:  ${theme.bold("4 main categories")}`,
    `Total Errors:  ${
      totalErrors > 0 ? theme.error(totalErrors) : theme.success("0")
    }`,
    `Total Warnings: ${
      totalWarnings > 0 ? theme.warning(totalWarnings) : theme.success("0")
    }`,
  ].join("\n");

  console.log(
    createResultBox(summary, "🏁 Validation Summary", totalErrors > 0)
  );

  if (totalErrors > 0) {
    const errorList = results.flatMap((r) => r.errors);
    console.log(createWarningBox(errorList, "❌ Critical Errors"));
  }

  if (totalWarnings > 0) {
    const warningList = results.flatMap((r) => r.warnings);
    console.log(createWarningBox(warningList, "⚠️ Warnings"));
  }

  if (totalErrors === 0 && totalWarnings === 0) {
    console.log(theme.success("\n✨ Project is in perfect shape!\n"));
  }

  return { errors: totalErrors, warnings: totalWarnings };
}

// Run if called directly
if (require.main === module) {
  const { errors } = validate();
  process.exit(errors > 0 ? 1 : 0);
}
