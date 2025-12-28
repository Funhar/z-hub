/**
 * Test Script
 *
 * Tests FHEVM examples by:
 * 1. Creating a temporary example project
 * 2. Installing dependencies
 * 3. Compiling contracts
 * 4. Running tests
 * 5. Cleaning up
 */

import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import ora from "ora";
import { execSync } from "child_process";
import { select } from "@inquirer/prompts";

const ROOT_DIR = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT_DIR, "examples-config.json");
const TEMP_DIR = path.join(ROOT_DIR, ".test-temp");

interface ExampleConfig {
  contract: string;
  test: string;
  description: string;
}

interface TestResult {
  example: string;
  success: boolean;
  duration: number;
  error?: string;
}

// Load config
function loadConfig(): Record<string, ExampleConfig> {
  const content = fs.readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(content).examples;
}

// Clean temp directory
function cleanTemp(): void {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
}

// Run a single example test
async function testExample(exampleName: string): Promise<TestResult> {
  const startTime = Date.now();
  const exampleDir = path.join(TEMP_DIR, exampleName);

  try {
    // Step 1: Create example
    const createSpinner = ora(`Creating ${exampleName}...`).start();
    execSync(
      `npx ts-node scripts/create-example.ts ${exampleName} ${exampleDir}`,
      { stdio: "pipe", cwd: ROOT_DIR }
    );
    createSpinner.succeed(`Created ${exampleName}`);

    // Step 2: Install dependencies
    const installSpinner = ora("Installing dependencies...").start();
    execSync("npm install", { stdio: "pipe", cwd: exampleDir });
    installSpinner.succeed("Dependencies installed");

    // Step 3: Compile
    const compileSpinner = ora("Compiling contracts...").start();
    try {
      execSync("npm run compile", { stdio: "pipe", cwd: exampleDir });
      compileSpinner.succeed("Compilation successful");
    } catch (compileError: any) {
      compileSpinner.fail("Compilation failed");
      const stdout = compileError.stdout?.toString() || "";
      const stderr = compileError.stderr?.toString() || "";
      throw new Error(`Compile Error:\n${stdout}\n${stderr}`);
    }

    // Step 4: Run tests
    const testSpinner = ora("Running tests...").start();
    try {
      execSync("npm run test", {
        stdio: "pipe",
        cwd: exampleDir,
        timeout: 300000,
      });
      testSpinner.succeed("Tests passed");
    } catch (testError: any) {
      testSpinner.fail("Tests failed");
      const stdout = testError.stdout?.toString() || "";
      const stderr = testError.stderr?.toString() || "";
      throw new Error(`Test Error:\n${stdout}\n${stderr}`);
    }

    const duration = (Date.now() - startTime) / 1000;
    return { example: exampleName, success: true, duration };
  } catch (error: any) {
    const duration = (Date.now() - startTime) / 1000;
    return {
      example: exampleName,
      success: false,
      duration,
      error: error.message || "Unknown error",
    };
  } finally {
    // Cleanup this example
    if (fs.existsSync(exampleDir)) {
      fs.rmSync(exampleDir, { recursive: true, force: true });
    }
  }
}

// Display test results
function displayResults(results: TestResult[]): void {
  console.log(chalk.gray("\n" + "=".repeat(60)));
  console.log(chalk.bold.cyan("\n📊 Test Results\n"));

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    if (result.success) {
      console.log(
        chalk.green(`  ✅ ${result.example}`) +
          chalk.gray(` (${result.duration.toFixed(1)}s)`)
      );
      passed++;
    } else {
      console.log(chalk.red(`  ❌ ${result.example}`));
      if (result.error) {
        // Show more error lines for debugging
        const errorLines = result.error.split("\n").slice(0, 30).join("\n");
        console.log(chalk.yellow("\n--- Error Details ---"));
        console.log(chalk.gray(errorLines));
        console.log(chalk.yellow("--- End Error ---\n"));
      }
      failed++;
    }
  }

  console.log(chalk.gray("\n" + "=".repeat(60)));
  console.log(
    chalk.bold(
      `\nResult: ${chalk.green(passed + " passed")}, ${chalk.red(
        failed + " failed"
      )}`
    )
  );

  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
  console.log(chalk.gray(`Total time: ${totalTime.toFixed(1)}s\n`));
}

// Interactive mode - select example
async function interactiveSelect(
  examples: Record<string, ExampleConfig>
): Promise<string | null> {
  const choices = Object.entries(examples).map(([key, value]) => ({
    name: `${key} - ${value.description}`,
    value: key,
  }));

  choices.push({ name: chalk.yellow("Cancel"), value: "__cancel__" });

  const selected = await select({
    message: "Select an example to test:",
    choices,
  });

  return selected === "__cancel__" ? null : selected;
}

// Main function
export async function runTest(exampleName?: string): Promise<void> {
  console.log(chalk.bold.cyan("\n🧪 Z-Hub Example Tester\n"));

  const examples = loadConfig();

  // Clean any previous temp files
  cleanTemp();
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  try {
    if (exampleName) {
      // Direct mode - test specific example
      if (!examples[exampleName]) {
        console.log(chalk.red(`\n❌ Example "${exampleName}" not found.\n`));
        console.log(chalk.yellow("Available examples:"));
        Object.keys(examples).forEach((name) => {
          console.log(chalk.gray(`  • ${name}`));
        });
        process.exit(1);
      }

      console.log(chalk.blue(`Testing: ${exampleName}\n`));
      const result = await testExample(exampleName);
      displayResults([result]);
      process.exit(result.success ? 0 : 1);
    } else {
      // Interactive mode
      const selected = await interactiveSelect(examples);
      if (!selected) {
        console.log(chalk.cyan("\n👋 Cancelled\n"));
        process.exit(0);
      }

      console.log(chalk.blue(`\nTesting: ${selected}\n`));
      const result = await testExample(selected);
      displayResults([result]);
      process.exit(result.success ? 0 : 1);
    }
  } finally {
    cleanTemp();
  }
}

// List all examples
function listExamples(): void {
  const examples = loadConfig();
  console.log(chalk.bold.cyan("\n📋 Available Examples\n"));
  Object.entries(examples).forEach(([key, value]) => {
    console.log(
      chalk.green(`  • ${key}`) + chalk.gray(` - ${value.description}`)
    );
  });
  console.log("");
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const firstArg = args[0];

  // Handle 'list' subcommand
  if (firstArg === "list" || firstArg === "--list" || firstArg === "-ls") {
    listExamples();
    process.exit(0);
  }

  runTest(firstArg).catch((error) => {
    console.error(chalk.red("Error:"), error.message);
    process.exit(1);
  });
}
