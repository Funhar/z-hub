#!/usr/bin/env ts-node

/**
 * Interactive CLI for FHEVM Examples Generator
 *
 * Usage: npm run cli
 */

import { select, input, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// Load configuration
function loadConfig() {
  const configPath = path.join(__dirname, "..", "examples-config.json");
  const configContent = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(configContent);
}

const config = loadConfig();

// Display banner
function displayBanner() {
  console.clear();
  console.log(
    chalk.cyan.bold(
      "\n╔═══════════════════════════════════════════════════════╗"
    )
  );
  console.log(
    chalk.cyan.bold("║                                                       ║")
  );
  console.log(
    chalk.cyan.bold("║       🔐 FHEVM Example Generator (Interactive)       ║")
  );
  console.log(
    chalk.cyan.bold("║                                                       ║")
  );
  console.log(
    chalk.cyan.bold(
      "╚═══════════════════════════════════════════════════════╝\n"
    )
  );
}

// Main menu
async function mainMenu() {
  displayBanner();

  const action = await select({
    message: "What would you like to do?",
    choices: [
      {
        name: "📂 Create a single example project",
        value: "create-example",
        description: "Generate a standalone project with one example",
      },
      {
        name: "📦 Create a category project",
        value: "create-category",
        description:
          "Generate a project with multiple examples from a category",
      },
      {
        name: "📚 Generate documentation",
        value: "generate-docs",
        description: "Create GitBook documentation for examples",
      },
      {
        name: "📋 List all examples",
        value: "list-examples",
        description: "Show all available examples",
      },
      {
        name: "❌ Exit",
        value: "exit",
        description: "Exit the CLI",
      },
    ],
  });

  return action;
}

// Create example workflow
async function createExampleWorkflow() {
  console.log(chalk.blue("\n📄 Create Single Example Project\n"));

  // Get examples list
  const examples = Object.entries(config.examples).map(
    ([key, value]: [string, any]) => ({
      name: `${key} - ${value.description}`,
      value: key,
      description: value.description,
    })
  );

  const exampleName = await select({
    message: "Select an example:",
    choices: examples,
    pageSize: 12,
  });

  const outputDir = await input({
    message: "Output directory:",
    default: `./output/fhevm-example-${exampleName}`,
  });

  const installDeps = await confirm({
    message: "Install dependencies after creation?",
    default: true,
  });

  // Create the example
  const spinner = ora("Creating example project...").start();

  try {
    execSync(
      `npx ts-node scripts/create-fhevm-example.ts ${exampleName} ${outputDir}`,
      {
        stdio: "pipe",
      }
    );
    spinner.succeed(chalk.green("Example project created successfully!"));

    if (installDeps) {
      const installSpinner = ora("Installing dependencies...").start();
      try {
        execSync("npm install", { cwd: outputDir, stdio: "pipe" });
        installSpinner.succeed(chalk.green("Dependencies installed!"));
      } catch (error) {
        installSpinner.fail(chalk.red("Failed to install dependencies"));
      }
    }

    console.log(chalk.cyan("\n✨ Next steps:"));
    console.log(chalk.white(`  cd ${outputDir}`));
    if (!installDeps) {
      console.log(chalk.white("  npm install"));
    }
    console.log(chalk.white("  npm run compile"));
    console.log(chalk.white("  npm run test\n"));
  } catch (error) {
    spinner.fail(chalk.red("Failed to create example"));
    console.error(error);
  }
}

// Create category workflow
async function createCategoryWorkflow() {
  console.log(chalk.blue("\n📦 Create Category Project\n"));

  // Get categories list
  const categories = Object.entries(config.categories).map(
    ([key, value]: [string, any]) => ({
      name: `${value.name} (${value.contracts.length} contracts)`,
      value: key,
      description: value.description,
    })
  );

  const categoryName = await select({
    message: "Select a category:",
    choices: categories,
  });

  const outputDir = await input({
    message: "Output directory:",
    default: `./output/fhevm-examples-${categoryName}`,
  });

  const installDeps = await confirm({
    message: "Install dependencies after creation?",
    default: true,
  });

  // Create the category project
  const spinner = ora("Creating category project...").start();

  try {
    execSync(
      `npx ts-node scripts/create-fhevm-category.ts ${categoryName} ${outputDir}`,
      {
        stdio: "pipe",
      }
    );
    spinner.succeed(chalk.green("Category project created successfully!"));

    if (installDeps) {
      const installSpinner = ora("Installing dependencies...").start();
      try {
        execSync("npm install", { cwd: outputDir, stdio: "pipe" });
        installSpinner.succeed(chalk.green("Dependencies installed!"));
      } catch (error) {
        installSpinner.fail(chalk.red("Failed to install dependencies"));
      }
    }

    console.log(chalk.cyan("\n✨ Next steps:"));
    console.log(chalk.white(`  cd ${outputDir}`));
    if (!installDeps) {
      console.log(chalk.white("  npm install"));
    }
    console.log(chalk.white("  npm run compile"));
    console.log(chalk.white("  npm run test\n"));
  } catch (error) {
    spinner.fail(chalk.red("Failed to create category project"));
    console.error(error);
  }
}

// Generate docs workflow
async function generateDocsWorkflow() {
  console.log(chalk.blue("\n📚 Generate Documentation\n"));

  const choices = [
    {
      name: "Generate all documentation",
      value: "all",
      description: "Generate docs for all examples",
    },
    ...Object.keys(config.examples).map((key) => ({
      name: key,
      value: key,
    })),
  ];

  const selection = await select({
    message: "Select documentation to generate:",
    choices,
    pageSize: 12,
  });

  const spinner = ora("Generating documentation...").start();

  try {
    if (selection === "all") {
      execSync("npx ts-node scripts/generate-docs.ts --all", { stdio: "pipe" });
    } else {
      execSync(`npx ts-node scripts/generate-docs.ts ${selection}`, {
        stdio: "pipe",
      });
    }
    spinner.succeed(chalk.green("Documentation generated successfully!"));
  } catch (error) {
    spinner.fail(chalk.red("Failed to generate documentation"));
    console.error(error);
  }
}

// List examples
function listExamples() {
  console.log(chalk.blue("\n📋 Available Examples\n"));

  console.log(chalk.cyan.bold("Basic Examples:"));
  Object.entries(config.examples).forEach(([key, value]: [string, any]) => {
    console.log(chalk.white(`  • ${chalk.green(key)}`));
    console.log(chalk.gray(`    ${value.description}\n`));
  });

  console.log(chalk.cyan.bold("\nCategories:"));
  Object.entries(config.categories).forEach(([key, value]: [string, any]) => {
    console.log(chalk.white(`  • ${chalk.green(key)} - ${value.name}`));
    console.log(chalk.gray(`    ${value.description}`));
    console.log(chalk.gray(`    Contracts: ${value.contracts.length}\n`));
  });
}

// Main function
async function main() {
  try {
    // Check for subcommands
    const args = process.argv.slice(2);
    const subcommand = args[0];

    // Handle --help flag
    if (
      subcommand === "--help" ||
      subcommand === "-h" ||
      subcommand === "help"
    ) {
      console.log(chalk.cyan.bold("\n🔐 FHEVM Example Generator CLI\n"));
      console.log(chalk.white("Usage: npm run cli [command] [options]\n"));

      console.log(chalk.yellow("Commands:\n"));
      console.log(chalk.white("  npm run cli"));
      console.log(chalk.gray("    Launch interactive menu\n"));

      console.log(
        chalk.white("  npm run cli-create <example-name> [output-dir]")
      );
      console.log(chalk.gray("    Create a single example project"));
      console.log(
        chalk.gray("    Example: npm run cli-create fhe-counter ./my-project\n")
      );

      console.log(
        chalk.white("  npm run cli-category <category-name> [output-dir]")
      );
      console.log(
        chalk.gray("    Create a category project with multiple examples")
      );
      console.log(
        chalk.gray("    Example: npm run cli-category basic ./my-examples\n")
      );

      console.log(chalk.white("  npm run cli-docs [example-name|--all]"));
      console.log(chalk.gray("    Generate documentation"));
      console.log(chalk.gray("    Example: npm run cli-docs fhe-counter\n"));

      console.log(chalk.white("  npm run cli-list"));
      console.log(
        chalk.gray("    List all available examples and categories\n")
      );

      console.log(chalk.white("  npm run cli-validate"));
      console.log(chalk.gray("    Validate examples (coming soon)\n"));

      console.log(chalk.yellow("Options:\n"));
      console.log(chalk.white("  --help, -h    Show this help message\n"));

      process.exit(0);
    }

    // Handle subcommands with non-interactive mode
    if (subcommand === "create") {
      // Non-interactive: npm run cli-create <example-name> <output-dir>
      const exampleName = args[1];
      const outputDir = args[2];

      if (!exampleName) {
        console.log(chalk.red("\n❌ Error: Example name required"));
        console.log(
          chalk.yellow(
            "Usage: npm run cli-create <example-name> [output-dir]\n"
          )
        );
        console.log(chalk.cyan("Available examples:"));
        Object.keys(config.examples).forEach((key) => {
          console.log(chalk.white(`  • ${key}`));
        });
        console.log();
        process.exit(1);
      }

      const finalOutputDir =
        outputDir || `./output/fhevm-example-${exampleName}`;

      const spinner = ora("Creating example project...").start();
      try {
        execSync(
          `npx ts-node scripts/create-fhevm-example.ts ${exampleName} ${finalOutputDir}`,
          { stdio: "pipe" }
        );
        spinner.succeed(chalk.green("Example project created successfully!"));

        console.log(chalk.cyan("\n✨ Next steps:"));
        console.log(chalk.white(`  cd ${finalOutputDir}`));
        console.log(chalk.white("  npm install"));
        console.log(chalk.white("  npm run compile"));
        console.log(chalk.white("  npm run test\n"));
      } catch (error) {
        spinner.fail(chalk.red("Failed to create example"));
        process.exit(1);
      }
      process.exit(0);
    } else if (subcommand === "category") {
      // Non-interactive: npm run cli-category <category-name> <output-dir>
      const categoryName = args[1];
      const outputDir = args[2];

      if (!categoryName) {
        console.log(chalk.red("\n❌ Error: Category name required"));
        console.log(
          chalk.yellow(
            "Usage: npm run cli-category <category-name> [output-dir]\n"
          )
        );
        console.log(chalk.cyan("Available categories:"));
        Object.entries(config.categories).forEach(
          ([key, value]: [string, any]) => {
            console.log(
              chalk.white(
                `  • ${key} - ${value.name} (${value.contracts.length} contracts)`
              )
            );
          }
        );
        console.log();
        process.exit(1);
      }

      const finalOutputDir =
        outputDir || `./output/fhevm-examples-${categoryName}`;

      const spinner = ora("Creating category project...").start();
      try {
        execSync(
          `npx ts-node scripts/create-fhevm-category.ts ${categoryName} ${finalOutputDir}`,
          { stdio: "pipe" }
        );
        spinner.succeed(chalk.green("Category project created successfully!"));

        console.log(chalk.cyan("\n✨ Next steps:"));
        console.log(chalk.white(`  cd ${finalOutputDir}`));
        console.log(chalk.white("  npm install"));
        console.log(chalk.white("  npm run compile"));
        console.log(chalk.white("  npm run test\n"));
      } catch (error) {
        spinner.fail(chalk.red("Failed to create category project"));
        process.exit(1);
      }
      process.exit(0);
    } else if (subcommand === "docs") {
      // Non-interactive: npm run cli-docs [example-name|--all]
      const target = args[1] || "--all";

      const spinner = ora("Generating documentation...").start();
      try {
        if (target === "--all") {
          execSync("npx ts-node scripts/generate-docs.ts --all", {
            stdio: "inherit",
          });
        } else {
          execSync(`npx ts-node scripts/generate-docs.ts ${target}`, {
            stdio: "inherit",
          });
        }
        spinner.stop();
        console.log(
          chalk.green("\n✅ Documentation generated successfully!\n")
        );
      } catch (error) {
        spinner.fail(chalk.red("Failed to generate documentation"));
        process.exit(1);
      }
      process.exit(0);
    } else if (subcommand === "list") {
      listExamples();
      process.exit(0);
    } else if (subcommand === "validate") {
      console.log(chalk.yellow("\n⚠️  Validate feature coming soon!\n"));
      process.exit(0);
    }

    // No subcommand - show interactive menu
    const action = await mainMenu();

    if (action === "exit") {
      console.log(chalk.cyan("\n👋 Goodbye!\n"));
      process.exit(0);
    }

    switch (action) {
      case "create-example":
        await createExampleWorkflow();
        break;
      case "create-category":
        await createCategoryWorkflow();
        break;
      case "generate-docs":
        await generateDocsWorkflow();
        break;
      case "list-examples":
        listExamples();
        break;
    }

    // Exit after completing the action
    console.log(chalk.cyan("\n✨ Done!\n"));
    process.exit(0);
  } catch (error) {
    if (error instanceof Error && error.message.includes("User force closed")) {
      console.log(chalk.cyan("\n👋 Goodbye!\n"));
      process.exit(0);
    }
    throw error;
  }
}

main();
