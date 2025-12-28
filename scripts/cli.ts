#!/usr/bin/env ts-node

/**
 * Interactive CLI for FHEVM Examples Generator
 *
 * Usage: npm run cli
 */

import { select, input, confirm } from "@inquirer/prompts";
import search from "@inquirer/search";
import chalk from "chalk";
import ora from "ora";
import * as fs from "fs";
import * as path from "path";
import { exec, execSync } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);
const ROOT_DIR = path.join(__dirname, "..");
import boxen from "boxen";
import figlet from "figlet";
import {
  colors,
  zamaGradient,
  successGradient,
  createSpinner,
  succeedSpinner,
  failSpinner,
  createHeader,
  createNextStepsBox,
  createInfoBox,
  styledPrompt,
  styledChoice,
  truncateText,
  theme,
} from "./utils/theme";

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
  const bannerText = figlet.textSync("Z-HUB", {
    font: "Standard",
    horizontalLayout: "fitted",
  });

  console.log(zamaGradient(bannerText));
  console.log(
    boxen(chalk.hex(colors.lavender).bold("🔐 FHEVM Example Factory & CLI"), {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 1, bottom: 1, left: 0, right: 0 },
      borderStyle: "round",
      borderColor: colors.mauve,
      title: "v1.0.0",
      titleAlignment: "right",
    })
  );
}

// Main menu
async function mainMenu() {
  displayBanner();

  const action = await select({
    message: chalk.hex(colors.lavender)("What would you like to do?"),
    choices: [
      {
        name: `📂 ${chalk
          .hex(colors.blue)
          .bold("Create")} a single example project`,
        value: "create-example",
        description: "Generate a standalone project with one example",
      },
      {
        name: `📦 ${chalk
          .hex(colors.sapphire)
          .bold("Create")} a category project`,
        value: "create-category",
        description:
          "Generate a project with multiple examples from a category",
      },
      {
        name: `📚 ${chalk.hex(colors.mauve).bold("Generate")} documentation`,
        value: "generate-docs",
        description: "Create GitBook documentation for examples",
      },
      {
        name: `📋 ${chalk.hex(colors.teal).bold("List")} all examples`,
        value: "list-examples",
        description: "Show all available examples",
      },
      {
        name: `❌ ${chalk.hex(colors.red).bold("Exit")}`,
        value: "exit",
        description: "Exit the CLI",
      },
    ],
  });

  return action;
}

// Create example workflow
async function createExampleWorkflow() {
  console.log(createHeader("📄 Create Single Example Project", colors.sky));

  const examples = Object.entries(config.examples).map(
    ([key, value]: [string, any]) => ({
      name: styledChoice(key, truncateText(value.description, 80)),
      value: key,
      fullDescription: value.description,
    })
  );

  const exampleName = await search({
    message: styledPrompt("🔍 Search > :"),
    pageSize: 12,
    source: async (input) => {
      const term = (input || "").toLowerCase();
      return examples.filter(
        (ex) =>
          ex.value.toLowerCase().includes(term) ||
          ex.fullDescription.toLowerCase().includes(term)
      );
    },
  });

  const outputDir = await input({
    message: styledPrompt("Output directory:"),
    default: `./output/${exampleName}`,
  });

  const installDeps = await confirm({
    message: styledPrompt("Install dependencies after creation?"),
    default: true,
  });

  const spinner = createSpinner("Creating example project...");

  try {
    await execAsync(
      `npx ts-node scripts/create-example.ts ${exampleName} ${outputDir}`,
      { cwd: ROOT_DIR }
    );
    succeedSpinner(spinner, "Example project created successfully!");

    if (installDeps) {
      const installSpinner = createSpinner("Installing dependencies...");
      try {
        await execAsync("npm install", { cwd: outputDir });
        succeedSpinner(installSpinner, "Dependencies installed!");
      } catch (error) {
        failSpinner(installSpinner, "Failed to install dependencies");
      }
    }

    const steps = [
      `cd ${outputDir}`,
      installDeps ? null : "npm install",
      "npm run compile",
      "npm run test",
    ].filter(Boolean) as string[];

    console.log(createNextStepsBox(steps));
  } catch (error) {
    failSpinner(spinner, "Failed to create example");
    console.error(error);
  }
}

// Create category workflow
async function createCategoryWorkflow() {
  console.log(createHeader("📦 Create Category Project", colors.sapphire));

  const categories = Object.entries(config.categories).map(
    ([key, value]: [string, any]) => ({
      name: `${styledChoice(value.name)} ${theme.dim(
        `(${value.contracts.length} contracts)`
      )}`,
      value: key,
    })
  );

  const categoryName = await select({
    message: styledPrompt("Select a category:"),
    choices: categories,
  });

  const outputDir = await input({
    message: styledPrompt("Output directory:"),
    default: `./output/${categoryName}`,
  });

  const installDeps = await confirm({
    message: styledPrompt("Install dependencies after creation?"),
    default: true,
  });

  const spinner = createSpinner("Creating category project...");

  try {
    await execAsync(
      `npx ts-node scripts/create-category.ts ${categoryName} ${outputDir}`,
      { cwd: ROOT_DIR }
    );
    succeedSpinner(spinner, "Category project created successfully!");

    if (installDeps) {
      const installSpinner = createSpinner("Installing dependencies...");
      try {
        await execAsync("npm install", { cwd: outputDir });
        succeedSpinner(installSpinner, "Dependencies installed!");
      } catch (error) {
        failSpinner(installSpinner, "Failed to install dependencies");
      }
    }

    const steps = [
      `cd ${outputDir}`,
      installDeps ? null : "npm install",
      "npm run compile",
      "npm run test",
    ].filter(Boolean) as string[];

    console.log(createNextStepsBox(steps));
  } catch (error) {
    failSpinner(spinner, "Failed to create category project");
    console.error(error);
  }
}

// Generate docs workflow
async function generateDocsWorkflow() {
  console.log(createHeader("📚 Generate Documentation", colors.mauve));

  const choices = [
    {
      name: theme.warning.bold("Generate all documentation"),
      value: "all",
    },
    ...Object.keys(config.examples).map((key) => ({
      name: theme.info(key),
      value: key,
    })),
  ];

  const selection = await select({
    message: styledPrompt("Select documentation to generate:"),
    choices,
    pageSize: 12,
  });

  const spinner = createSpinner("Generating documentation...");

  try {
    if (selection === "all") {
      await execAsync("npx ts-node scripts/generate-docs.ts --all", {
        cwd: ROOT_DIR,
      });
    } else {
      await execAsync(`npx ts-node scripts/generate-docs.ts ${selection}`, {
        cwd: ROOT_DIR,
      });
    }
    succeedSpinner(spinner, "Documentation generated successfully!");
  } catch (error) {
    failSpinner(spinner, "Failed to generate documentation");
    console.error(error);
  }
}

// List examples
function listExamples() {
  let output = "";

  output += theme.info.bold("\n📄 Available Examples\n");
  Object.entries(config.examples).forEach(([key, value]: [string, any]) => {
    output += `  ${theme.success.bold("•")} ${theme.primary(key)}\n`;
    output += `    ${theme.dim(truncateText(value.description, 120))}\n\n`;
  });

  output += theme.info.bold("📦 Categories\n");
  Object.entries(config.categories).forEach(([key, value]: [string, any]) => {
    output += `  ${theme.success.bold("•")} ${theme.primary(
      value.name
    )} ${theme.dim(`(${key})`)}\n`;
    output += `    ${theme.dim(truncateText(value.description, 120))}\n`;
    output += `    ${theme.warning.italic("Contracts:")} ${
      value.contracts.length
    }\n\n`;
  });

  console.log(createInfoBox(output, "📋 Examples & Categories"));
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
      const helpText = `
${chalk.hex(colors.yellow).bold("Usage:")} ${chalk.white(
        "npm run cli [command] [options]"
      )}

${chalk.hex(colors.mauve).bold("Commands:")}
  ${chalk.hex(colors.blue)(
    "npm run cli"
  )}                             ${chalk.gray("Launch interactive menu")}
  ${chalk.hex(colors.blue)("npm run cli:create")} ${chalk.hex(colors.green)(
        "<name> [dir]"
      )}      ${chalk.gray("Create a single example project")}
  ${chalk.hex(colors.blue)("npm run cli:category")} ${chalk.hex(colors.green)(
        "<name> [dir]"
      )}    ${chalk.gray("Create a category project")}
  ${chalk.hex(colors.blue)("npm run cli:docs")} ${chalk.hex(colors.green)(
        "[name|--all]"
      )}        ${chalk.gray("Generate documentation")}
  ${chalk.hex(colors.blue)(
    "npm run cli:list"
  )}                       ${chalk.gray("List all available examples")}
  ${chalk.hex(colors.blue)(
    "npm run cli:scan"
  )}                       ${chalk.gray("Scan contracts and update config")}
  ${chalk.hex(colors.blue)(
    "npm run cli:validate"
  )}                   ${chalk.gray("Validate examples")}
  ${chalk.hex(colors.blue)("npm run cli:test")} ${chalk.hex(colors.green)(
        "[name]"
      )}             ${chalk.gray("Run tests for examples")}

${chalk.hex(colors.mauve).bold("Options:")}
  ${chalk.hex(colors.yellow)(
    "--help, -h"
  )}                            ${chalk.gray("Show this help message")}
`;

      console.log(
        boxen(helpText, {
          title: "🔐 FHEVM Example Generator CLI",
          padding: 1,
          margin: 1,
          borderStyle: "round",
          borderColor: colors.mauve,
        })
      );

      process.exit(0);
    }

    // Handle subcommands with non-interactive mode
    if (subcommand === "create") {
      const exampleName = args[1];
      const outputDir = args[2];

      if (!exampleName) {
        console.log(chalk.hex(colors.red)("\n❌ Error: Example name required"));
        listExamples();
        process.exit(1);
      }

      const finalOutputDir =
        outputDir || `./output/fhevm-example-${exampleName}`;

      const spinner = ora({
        text: chalk.hex(colors.blue)("Creating example project..."),
        color: "blue",
      }).start();
      try {
        await execAsync(
          `npx ts-node scripts/create-example.ts ${exampleName} ${finalOutputDir}`,
          { cwd: ROOT_DIR }
        );
        spinner.succeed(
          successGradient("Example project created successfully!")
        );

        const nextSteps = [
          `cd ${finalOutputDir}`,
          "npm install",
          "npm run compile",
          "npm run test",
        ]
          .map((step) => chalk.hex(colors.yellow)(`  $ ${step}`))
          .join("\n");

        console.log(
          boxen(nextSteps, {
            title: "✨ Next Steps",
            padding: 1,
            margin: { top: 1, bottom: 1 },
            borderStyle: "round",
            borderColor: colors.peach,
          })
        );
      } catch (error) {
        spinner.fail(chalk.hex(colors.red)("Failed to create example"));
        process.exit(1);
      }
      process.exit(0);
    } else if (subcommand === "category") {
      const categoryName = args[1];
      const outputDir = args[2];

      if (!categoryName) {
        console.log(
          chalk.hex(colors.red)("\n❌ Error: Category name required")
        );
        listExamples();
        process.exit(1);
      }

      const finalOutputDir =
        outputDir || `./output/fhevm-examples-${categoryName}`;

      const spinner = ora({
        text: chalk.hex(colors.blue)("Creating category project..."),
        color: "blue",
      }).start();
      try {
        await execAsync(
          `npx ts-node scripts/create-category.ts ${categoryName} ${finalOutputDir}`,
          { cwd: ROOT_DIR }
        );
        spinner.succeed(
          successGradient("Category project created successfully!")
        );

        const nextSteps = [
          `cd ${finalOutputDir}`,
          "npm install",
          "npm run compile",
          "npm run test",
        ]
          .map((step) => chalk.hex(colors.yellow)(`  $ ${step}`))
          .join("\n");

        console.log(
          boxen(nextSteps, {
            title: "✨ Next Steps",
            padding: 1,
            margin: { top: 1, bottom: 1 },
            borderStyle: "round",
            borderColor: colors.peach,
          })
        );
      } catch (error) {
        spinner.fail(
          chalk.hex(colors.red)("Failed to create category project")
        );
        process.exit(1);
      }
      process.exit(0);
    } else if (subcommand === "docs") {
      const target = args[1] || "--all";

      const spinner = ora({
        text: chalk.hex(colors.blue)("Generating documentation..."),
        color: "blue",
      }).start();
      try {
        if (target === "--all") {
          await execAsync("npx ts-node scripts/generate-docs.ts --all", {
            cwd: ROOT_DIR,
          });
        } else {
          await execAsync(`npx ts-node scripts/generate-docs.ts ${target}`, {
            cwd: ROOT_DIR,
          });
        }
        spinner.stop();
        console.log(
          successGradient("\n✅ Documentation generated successfully!\n")
        );
      } catch (error) {
        spinner.fail(chalk.hex(colors.red)("Failed to generate documentation"));
        process.exit(1);
      }
      process.exit(0);
    } else if (subcommand === "scan") {
      const spinner = ora({
        text: chalk.hex(colors.blue)("Scanning contracts and tests..."),
        color: "blue",
      }).start();
      try {
        await execAsync("npx ts-node scripts/scan.ts", { cwd: ROOT_DIR });
        spinner.stop();
        console.log(successGradient("\n✅ Scan completed!\n"));
      } catch (error) {
        spinner.fail(chalk.hex(colors.red)("Scan failed"));
        process.exit(1);
      }
      process.exit(0);
    } else if (subcommand === "list") {
      listExamples();
      process.exit(0);
    } else if (subcommand === "validate") {
      const spinner = ora({
        text: chalk.hex(colors.blue)("Validating project..."),
        color: "blue",
      }).start();
      try {
        await execAsync("npx ts-node scripts/validate.ts", { cwd: ROOT_DIR });
        spinner.stop();
        console.log(successGradient("\n✅ Validation completed!\n"));
      } catch (error) {
        spinner.fail(chalk.hex(colors.red)("Validation failed"));
        process.exit(1);
      }
      process.exit(0);
    } else if (subcommand === "test") {
      const arg = args[1] || "";
      try {
        if (arg) {
          execSync(`npx ts-node scripts/run-tests.ts ${arg}`, {
            stdio: "inherit",
          });
        } else {
          execSync("npx ts-node scripts/run-tests.ts", { stdio: "inherit" });
        }
      } catch (error) {
        process.exit(1);
      }
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
