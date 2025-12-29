import { select, input, confirm } from "@inquirer/prompts";
import search from "@inquirer/search";
import chalk from "chalk";
import figlet from "figlet";
import boxen from "boxen";
import {
  colors,
  zamaGradient,
  theme,
  createHeader,
  createInfoBox,
  styledPrompt,
  styledChoice,
  truncateText,
} from "../utils/theme";
import { runWithSpinner, showNextSteps, ROOT_DIR } from "../utils/cli-common";

/**
 * Display CLI banner
 */
export function displayBanner() {
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

/**
 * Main interactive menu
 */
export async function mainMenu() {
  displayBanner();

  return await select({
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
}

/**
 * Create example workflow
 */
export async function createExampleWorkflow(config: any) {
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

  try {
    await runWithSpinner(
      "Creating example project...",
      `npx ts-node scripts/create-example.ts ${exampleName} ${outputDir}`,
      "Example project created successfully!"
    );

    if (installDeps) {
      await runWithSpinner(
        "Installing dependencies...",
        "npm install",
        "Dependencies installed!",
        outputDir
      );
    }

    showNextSteps(outputDir, installDeps);
  } catch (error) {
    // Error handled by runWithSpinner
  }
}

/**
 * Create category workflow
 */
export async function createCategoryWorkflow(config: any) {
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

  try {
    await runWithSpinner(
      "Creating category project...",
      `npx ts-node scripts/create-category.ts ${categoryName} ${outputDir}`,
      "Category project created successfully!"
    );

    if (installDeps) {
      await runWithSpinner(
        "Installing dependencies...",
        "npm install",
        "Dependencies installed!",
        outputDir
      );
    }

    showNextSteps(outputDir, installDeps);
  } catch (error) {
    // Error handled by runWithSpinner
  }
}

/**
 * Generate documentation workflow
 */
export async function generateDocsWorkflow(config: any) {
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

  try {
    const cmd =
      selection === "all"
        ? "npx ts-node scripts/generate-docs.ts --all"
        : `npx ts-node scripts/generate-docs.ts ${selection}`;

    await runWithSpinner(
      "Generating documentation...",
      cmd,
      "Documentation generated successfully!"
    );
  } catch (error) {
    // Error handled by runWithSpinner
  }
}

/**
 * List all examples
 */
export function listExamples(config: any) {
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
