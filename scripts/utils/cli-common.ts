import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import chalk from "chalk";
import boxen from "boxen";
import {
  colors,
  createSpinner,
  succeedSpinner,
  failSpinner,
  createNextStepsBox,
} from "./theme";

export const execAsync = promisify(exec);
export const ROOT_DIR = path.join(__dirname, "..", "..");

/**
 * Runs a command with a spinner and handles success/error
 */
export async function runWithSpinner(
  spinnerMessage: string,
  command: string,
  successMessage: string,
  cwd: string = ROOT_DIR
): Promise<void> {
  const spinner = createSpinner(spinnerMessage);
  try {
    await execAsync(command, { cwd });
    succeedSpinner(spinner, successMessage);
  } catch (error: any) {
    failSpinner(spinner, `Failed: ${spinnerMessage}`);
    throw error;
  }
}

/**
 * Shows generic next steps box
 */
export function showNextSteps(outputDir: string, installDeps: boolean = true) {
  const steps = [
    `cd ${outputDir}`,
    installDeps ? null : "npm install",
    "npm run compile",
    "npm run test",
  ].filter(Boolean) as string[];

  console.log(createNextStepsBox(steps));
}

/**
 * Show help message
 */
export function showHelp() {
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
}
