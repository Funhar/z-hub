import chalk from "chalk";
import gradient from "gradient-string";
import ora, { Ora } from "ora";
import boxen from "boxen";

// Catppuccin Mocha Palette
export const colors = {
  blue: "#89b4fa",
  lavender: "#b4befe",
  sapphire: "#74c7ec",
  sky: "#89dceb",
  teal: "#94e2d5",
  green: "#a6e3a1",
  yellow: "#f9e2af",
  peach: "#fab387",
  maroon: "#eba0ac",
  red: "#f38ba8",
  mauve: "#cba6f7",
  pink: "#f5c2e7",
  flamingo: "#f2cdcd",
  rosewater: "#f5e0dc",
};

export const zamaGradient = gradient([colors.blue, colors.mauve, colors.pink]);
export const successGradient = gradient([colors.green, colors.teal]);
export const warningGradient = gradient([colors.yellow, colors.peach]);
export const errorGradient = gradient([colors.maroon, colors.red]);

export const theme = {
  primary: chalk.hex(colors.lavender),
  secondary: chalk.hex(colors.mauve),
  success: chalk.hex(colors.green),
  warning: chalk.hex(colors.yellow),
  error: chalk.hex(colors.red),
  info: chalk.hex(colors.sky),
  dim: chalk.gray,
  bold: chalk.bold,
};

// ============================================================================
// Spinner Helpers
// ============================================================================

/**
 * Create a themed spinner with consistent styling
 */
export function createSpinner(message: string): Ora {
  return ora({
    text: theme.info(message),
    color: "blue",
  }).start();
}

/**
 * Complete spinner with success message
 */
export function succeedSpinner(spinner: Ora, message: string): void {
  spinner.succeed(successGradient(message));
}

/**
 * Complete spinner with error message
 */
export function failSpinner(spinner: Ora, message: string): void {
  spinner.fail(theme.error(message));
}

// ============================================================================
// Boxen Helpers
// ============================================================================

interface BoxOptions {
  color?: string;
  padding?: number;
  margin?: { top?: number; bottom?: number; left?: number; right?: number };
}

/**
 * Create a header box with consistent styling
 */
export function createHeader(
  title: string,
  color: string = colors.sky
): string {
  return boxen(chalk.hex(color).bold(title), {
    padding: 0,
    margin: { top: 1, bottom: 1 },
    borderStyle: "bold",
    borderColor: color,
  });
}

/**
 * Create a result box with dynamic border color based on success/failure
 */
export function createResultBox(
  content: string,
  title: string,
  hasErrors: boolean = false
): string {
  return boxen(content, {
    title,
    padding: 1,
    margin: { top: 1, bottom: 1 },
    borderStyle: "round",
    borderColor: hasErrors ? colors.red : colors.green,
  });
}

/**
 * Create a "Next Steps" box with consistent styling
 */
export function createNextStepsBox(steps: string[]): string {
  const content = steps
    .filter(Boolean)
    .map((step) => chalk.hex(colors.yellow)(`  $ ${step}`))
    .join("\n");

  return boxen(content, {
    title: "✨ Next Steps",
    padding: 1,
    margin: { top: 1, bottom: 1 },
    borderStyle: "round",
    borderColor: colors.peach,
  });
}

/**
 * Create a generic info box
 */
export function createInfoBox(
  content: string,
  title: string,
  color: string = colors.mauve
): string {
  return boxen(content, {
    title,
    padding: 1,
    margin: { top: 1, bottom: 1 },
    borderStyle: "round",
    borderColor: color,
  });
}

/**
 * Create a warning box with list items
 */
export function createWarningBox(items: string[], title: string): string {
  const content = items.map((item) => `  • ${item}`).join("\n");
  return boxen(content, {
    title,
    padding: 0,
    margin: { top: 1, bottom: 1 },
    borderStyle: "round",
    borderColor: colors.yellow,
  });
}

// ============================================================================
// Message Helpers
// ============================================================================

/**
 * Create a styled prompt message
 */
export function styledPrompt(message: string): string {
  return theme.primary(message);
}

/**
 * Create a styled choice item for select prompts
 */
export function styledChoice(name: string, description?: string): string {
  if (description) {
    return `${theme.success.bold(name)} - ${theme.dim(description)}`;
  }
  return theme.success.bold(name);
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number = 60): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + "...";
}
