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
import { exec, execSync } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);
import search from "@inquirer/search";
import boxen from "boxen";
import figlet from "figlet";
import {
  colors,
  createSpinner,
  failSpinner,
  styledChoice,
  styledPrompt,
  succeedSpinner,
  theme,
  truncateText,
  zamaGradient,
} from "./utils/theme";

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
  testsPassed?: number;
  testsFailed?: number;
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
    const spinner = createSpinner(`Creating ${exampleName}...`);
    await execAsync(
      `npx ts-node scripts/create-example.ts ${exampleName} ${exampleDir}`,
      { cwd: ROOT_DIR }
    );
    succeedSpinner(spinner, `Created ${exampleName}`);

    const installSpinner = createSpinner("Installing dependencies...");
    await execAsync("npm install", { cwd: exampleDir });
    succeedSpinner(installSpinner, "Dependencies installed");

    const compileSpinner = createSpinner("Compiling contracts...");
    try {
      await execAsync("npm run compile", { cwd: exampleDir });
      succeedSpinner(compileSpinner, "Compilation successful");
    } catch (compileError: any) {
      failSpinner(compileSpinner, "Compilation failed");
      throw new Error(
        `Compile Error:\n${compileError.stdout}\n${compileError.stderr}`
      );
    }

    const testSpinner = createSpinner("Running tests...");
    let testsPassed = 0;
    let testsFailed = 0;
    try {
      const { stdout: testOutput } = await execAsync("npm run test", {
        cwd: exampleDir,
        timeout: 300000,
      });

      const passingMatch = testOutput.match(/(\d+)\s+passing/);
      const failingMatch = testOutput.match(/(\d+)\s+failing/);

      if (passingMatch) testsPassed = parseInt(passingMatch[1], 10);
      if (failingMatch) testsFailed = parseInt(failingMatch[1], 10);

      succeedSpinner(testSpinner, `Tests passed (${testsPassed} tests)`);
    } catch (testError: any) {
      failSpinner(testSpinner, "Tests failed");
      const stdout = testError.stdout?.toString() || "";
      const stderr = testError.stderr?.toString() || "";

      // Try to parse counts even from failed output
      const passingMatch = stdout.match(/(\d+)\s+passing/);
      const failingMatch = stdout.match(/(\d+)\s+failing/);
      if (passingMatch) testsPassed = parseInt(passingMatch[1], 10);
      if (failingMatch) testsFailed = parseInt(failingMatch[1], 10);

      throw new Error(`Test Error:\n${stdout}\n${stderr}`);
    }

    const duration = (Date.now() - startTime) / 1000;
    return {
      example: exampleName,
      success: true,
      duration,
      testsPassed,
      testsFailed,
    };
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
  let output = "";

  let examplesPassed = 0;
  let examplesFailed = 0;
  let totalTestsPassed = 0;
  let totalTestsFailed = 0;

  for (const result of results) {
    if (result.success) {
      const testInfo = result.testsPassed
        ? theme.dim(` - ${result.testsPassed} tests`)
        : "";
      output += `${theme.success(
        `  ✅ ${result.example}`
      )}${testInfo}${theme.dim(` (${result.duration.toFixed(1)}s)`)}\n`;
      examplesPassed++;
      totalTestsPassed += result.testsPassed || 0;
      totalTestsFailed += result.testsFailed || 0;
    } else {
      const testInfo =
        result.testsPassed || result.testsFailed
          ? theme.dim(
              ` - ${result.testsPassed || 0} passed, ${
                result.testsFailed || 0
              } failed`
            )
          : "";
      output += `${theme.error(`  ❌ ${result.example}`)}${testInfo}\n`;
      if (result.error) {
        // Show more error lines for debugging
        const errorLines = result.error.split("\n").slice(0, 15).join("\n");
        output += `\n${theme.warning("  --- Error Preview ---")}\n`;
        output += theme.dim(
          errorLines
            .split("\n")
            .map((l) => `  ${l}`)
            .join("\n")
        );
        output += `\n${theme.warning("  --------------------")}\n\n`;
      }
      examplesFailed++;
      totalTestsPassed += result.testsPassed || 0;
      totalTestsFailed += result.testsFailed || 0;
    }
  }

  const summary = [
    `Examples: ${theme.success(examplesPassed + " passed")}, ${theme.error(
      examplesFailed + " failed"
    )}`,
    totalTestsPassed > 0 || totalTestsFailed > 0
      ? `Tests:    ${theme.success(
          totalTestsPassed + " passed"
        )}, ${theme.error(totalTestsFailed + " failed")}`
      : null,
    `Time:     ${theme.dim(
      results.reduce((sum, r) => sum + r.duration, 0).toFixed(1) + "s"
    )}`,
  ]
    .filter(Boolean)
    .join("\n");

  console.log(
    boxen(output + "\n" + summary, {
      title: "📊 Test Results",
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: examplesFailed > 0 ? colors.red : colors.green,
    })
  );
}

// Interactive mode - select example
async function interactiveSelect(
  examples: Record<string, ExampleConfig>
): Promise<string | null> {
  const choices = Object.entries(examples).map(([key, value]) => ({
    name: styledChoice(key, truncateText(value.description, 100)),
    value: key,
    fullDescription: value.description,
  }));

  const selected = await search({
    message: styledPrompt("🔍 Search test > :"),
    pageSize: 12,
    source: async (input) => {
      const term = (input || "").toLowerCase();
      const filtered = choices.filter(
        (ex) =>
          ex.value.toLowerCase().includes(term) ||
          ex.fullDescription.toLowerCase().includes(term)
      );
      // Add cancel option at the end
      return [
        ...filtered,
        { name: theme.error("Cancel"), value: "__cancel__" },
      ];
    },
  });

  return selected === "__cancel__" ? null : selected;
}

// Main function
export async function runTest(exampleName?: string): Promise<void> {
  const banner = figlet.textSync("Z-TEST", { font: "Small" });
  console.log(zamaGradient(banner));
  console.log(
    boxen(theme.secondary.bold("🧪 Z-Hub Example Tester"), {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: colors.mauve,
    })
  );

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
