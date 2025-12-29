#!/usr/bin/env ts-node

/**
 * Interactive CLI for FHEVM Examples Generator
 *
 * Usage: npm run cli
 */

import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { execSync } from "child_process";
import { colors, theme } from "./utils/theme";
import {
  runWithSpinner,
  showNextSteps,
  showHelp,
  ROOT_DIR,
} from "./utils/cli-common";
import {
  mainMenu,
  createExampleWorkflow,
  createCategoryWorkflow,
  generateDocsWorkflow,
  listExamples,
} from "./workflows/interactive";

// Load configuration
function loadConfig() {
  const configPath = path.join(__dirname, "..", "examples-config.json");
  const configContent = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(configContent);
}

const config = loadConfig();

/**
 * Main function - Routing and Loop
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    const subcommand = args[0];

    // 1. Handle help
    if (["--help", "-h", "help"].includes(subcommand)) {
      showHelp();
      process.exit(0);
    }

    // 2. Handle subcommands (Non-interactive)
    if (subcommand === "create") {
      const exampleName = args[1];
      const outputDir = args[2] || `./output/${exampleName}`;
      if (!exampleName) {
        console.log(theme.error("\n❌ Error: Example name required"));
        listExamples(config);
        process.exit(1);
      }
      await runWithSpinner(
        "Creating example project...",
        `npx ts-node scripts/create-example.ts ${exampleName} ${outputDir}`,
        "Example project created successfully!"
      );
      showNextSteps(outputDir);
      process.exit(0);
    }

    if (subcommand === "category") {
      const catName = args[1];
      const outputDir = args[2] || `./output/${catName}`;
      if (!catName) {
        console.log(theme.error("\n❌ Error: Category name required"));
        listExamples(config);
        process.exit(1);
      }
      await runWithSpinner(
        "Creating category project...",
        `npx ts-node scripts/create-category.ts ${catName} ${outputDir}`,
        "Category project created successfully!"
      );
      showNextSteps(outputDir);
      process.exit(0);
    }

    if (subcommand === "docs") {
      const target = args[1] || "--all";
      const cmd =
        target === "--all"
          ? "npx ts-node scripts/generate-docs.ts --all"
          : `npx ts-node scripts/generate-docs.ts ${target}`;
      await runWithSpinner(
        "Generating documentation...",
        cmd,
        "Documentation generated successfully!"
      );
      process.exit(0);
    }

    if (subcommand === "scan") {
      execSync("npx ts-node scripts/scan.ts", {
        stdio: "inherit",
        cwd: ROOT_DIR,
      });
      process.exit(0);
    }

    if (subcommand === "validate") {
      execSync("npx ts-node scripts/validate.ts", {
        stdio: "inherit",
        cwd: ROOT_DIR,
      });
      process.exit(0);
    }

    if (subcommand === "list") {
      listExamples(config);
      process.exit(0);
    }

    if (subcommand === "test") {
      const arg = args[1] || "";
      execSync(`npx ts-node scripts/run-tests.ts ${arg}`, {
        stdio: "inherit",
        cwd: ROOT_DIR,
      });
      process.exit(0);
    }

    // 3. No subcommand - Launch Interactive Menu
    const action = await mainMenu();

    if (action === "exit") {
      console.log(chalk.cyan("\n👋 Goodbye!\n"));
      process.exit(0);
    }

    switch (action) {
      case "create-example":
        await createExampleWorkflow(config);
        break;
      case "create-category":
        await createCategoryWorkflow(config);
        break;
      case "generate-docs":
        await generateDocsWorkflow(config);
        break;
      case "list-examples":
        listExamples(config);
        break;
    }

    console.log(chalk.cyan("\n✨ Done!\n"));
    process.exit(0);
  } catch (error: any) {
    if (error?.message?.includes("User force closed")) {
      console.log(chalk.cyan("\n👋 Goodbye!\n"));
      process.exit(0);
    }
    // Error already logged by helpers
    process.exit(1);
  }
}

main();
