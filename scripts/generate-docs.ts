#!/usr/bin/env ts-node

/**
 * generate-docs - Generates GitBook-formatted documentation from contracts and tests
 *
 * Usage: ts-node scripts/generate-docs.ts <example-name> [options]
 *
 * Example: ts-node scripts/generate-docs.ts fhe-counter --output docs/
 */

import * as fs from "fs";
import * as path from "path";
import {
  createInfoBox,
  createResultBox,
  theme,
  zamaGradient,
} from "./utils/theme";

function info(message: string): void {
  console.log(theme.info(`ℹ️  ${message}`));
}

function error(message: string): never {
  console.log(theme.error(`❌ Error: ${message}`));
  process.exit(1);
}

// Documentation configuration interface
interface DocsConfig {
  title: string;
  description: string;
  contract: string;
  test: string;
  output: string;
  category: string;
}

// Generate documentation options
interface GenerateDocsOptions {
  noSummary?: boolean;
}

// Load documentation configuration from JSON
function loadDocsConfig(): Record<string, DocsConfig> {
  const configPath = path.join(__dirname, "..", "examples-config.json");
  const configContent = fs.readFileSync(configPath, "utf-8");
  const config = JSON.parse(configContent);

  // Merge examples and docs config
  const docsConfig: Record<string, DocsConfig> = {};
  const examples = config.examples;
  const docs = config.docs;

  for (const exampleName in examples) {
    if (docs[exampleName]) {
      docsConfig[exampleName] = {
        ...docs[exampleName],
        contract: examples[exampleName].contract,
        test: examples[exampleName].test,
      };
    }
  }

  return docsConfig;
}

const EXAMPLES_CONFIG = loadDocsConfig();

function readFile(filePath: string): string {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    error(`File not found: ${filePath}`);
  }
  return fs.readFileSync(fullPath, "utf-8");
}

function getContractName(content: string): string {
  const match = content.match(/^\s*contract\s+(\w+)(?:\s+is\s+|\s*\{)/m);
  return match ? match[1] : "Contract";
}

function extractDescription(content: string): string {
  // Extract description from first multi-line comment or @notice
  const commentMatch = content.match(/\/\*\*\s*\n\s*\*\s*(.+?)\s*\n/);
  const noticeMatch = content.match(/@notice\s+(.+)/);

  return commentMatch ? commentMatch[1] : noticeMatch ? noticeMatch[1] : "";
}

function generateGitBookMarkdown(
  config: DocsConfig,
  contractContent: string,
  testContent: string
): string {
  const contractName = getContractName(contractContent);
  const description = config.description || extractDescription(contractContent);

  let markdown = `${description}\n\n`;

  // Add hint block
  markdown += `{% hint style="info" %}\n`;
  markdown += `To run this example correctly, make sure the files are placed in the following directories:\n\n`;
  markdown += `- \`.sol\` file → \`<your-project-root-dir>/contracts/\`\n`;
  markdown += `- \`.ts\` file → \`<your-project-root-dir>/test/\`\n\n`;
  markdown += `This ensures Hardhat can compile and test your contracts as expected.\n`;
  markdown += `{% endhint %}\n\n`;

  // Add tabs for contract and test
  markdown += `{% tabs %}\n\n`;

  // Contract tab
  markdown += `{% tab title="${contractName}.sol" %}\n\n`;
  markdown += `\`\`\`solidity\n`;
  markdown += contractContent;
  markdown += `\n\`\`\`\n\n`;
  markdown += `{% endtab %}\n\n`;

  // Test tab
  const testFileName = path.basename(config.test);
  markdown += `{% tab title="${testFileName}" %}\n\n`;
  markdown += `\`\`\`typescript\n`;
  markdown += testContent;
  markdown += `\n\`\`\`\n\n`;
  markdown += `{% endtab %}\n\n`;

  markdown += `{% endtabs %}\n`;

  return markdown;
}

function updateSummary(exampleName: string, config: DocsConfig): void {
  const summaryPath = path.join(process.cwd(), "docs", "SUMMARY.md");

  if (!fs.existsSync(summaryPath)) {
    console.log(theme.warning("Creating new SUMMARY.md"));
    const summary = `## Basic\n\n`;
    fs.writeFileSync(summaryPath, summary);
  }

  const summary = fs.readFileSync(summaryPath, "utf-8");
  const outputFileName = path.basename(config.output);
  const linkText = config.title;
  const link = `- [${linkText}](${outputFileName})`;

  // Check if already in summary
  if (summary.includes(outputFileName)) {
    info("Example already in SUMMARY.md");
    return;
  }

  // Add to appropriate category
  const categoryHeader = `## ${config.category}`;
  let updatedSummary: string;

  if (summary.includes(categoryHeader)) {
    // Add under existing category
    const lines = summary.split("\n");
    const categoryIndex = lines.findIndex(
      (line) => line.trim() === categoryHeader
    );

    // Find next category or end
    let insertIndex = categoryIndex + 1;
    while (insertIndex < lines.length && !lines[insertIndex].startsWith("##")) {
      if (lines[insertIndex].trim() === "") {
        break;
      }
      insertIndex++;
    }

    lines.splice(insertIndex, 0, link);
    updatedSummary = lines.join("\n");
  } else {
    // Add new category
    updatedSummary = summary.trim() + `\n\n${categoryHeader}\n\n${link}\n`;
  }

  fs.writeFileSync(summaryPath, updatedSummary);
  console.log(theme.success("Updated SUMMARY.md"));
}

function generateDocs(
  exampleName: string,
  options: GenerateDocsOptions = {}
): void {
  const config = EXAMPLES_CONFIG[exampleName];

  if (!config) {
    error(
      `Unknown example: ${exampleName}\n\nAvailable examples:\n${Object.keys(
        EXAMPLES_CONFIG
      )
        .map((k) => `  - ${k}`)
        .join("\n")}`
    );
  }

  info(`Generating documentation for: ${config.title}`);

  // Read contract and test files
  const contractContent = readFile(config.contract);
  const testContent = readFile(config.test);

  // Generate GitBook markdown
  const markdown = generateGitBookMarkdown(
    config,
    contractContent,
    testContent
  );

  // Write output file
  const outputPath = path.join(process.cwd(), config.output);
  const outputDir = path.dirname(outputPath);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, markdown);
  console.log(theme.success(`Documentation generated: ${config.output}`));

  // Update SUMMARY.md
  if (!options.noSummary) {
    updateSummary(exampleName, config);
  }

  console.log(
    createResultBox(
      theme.success(
        `Documentation for "${config.title}" generated successfully!`
      ),
      "✅ Success",
      false
    )
  );
}

function generateAllDocs(): void {
  info("Generating documentation for all examples...\n");

  let successCount = 0;
  let errorCount = 0;

  for (const exampleName of Object.keys(EXAMPLES_CONFIG)) {
    try {
      generateDocs(exampleName, { noSummary: true });
      successCount++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.log(
        theme.error(
          `Failed to generate docs for ${exampleName}: ${errorMessage}`
        )
      );
      errorCount++;
    }
  }

  // Update summary once at the end
  info("\nUpdating SUMMARY.md...");
  for (const exampleName of Object.keys(EXAMPLES_CONFIG)) {
    const config = EXAMPLES_CONFIG[exampleName];
    updateSummary(exampleName, config);
  }

  const finalOutput = [
    `Generated: ${theme.success(successCount)} documentation files`,
    errorCount > 0 ? `Failed:    ${theme.error(errorCount)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  console.log(
    createResultBox(finalOutput, "📚 Docs Generation Result", errorCount > 0)
  );
}

// Main execution
function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(zamaGradient("\n📚 FHEVM Documentation Generator\n"));

    let helpText = `${theme.dim("Usage: npm run cli:docs [name|--all]")}\n\n`;
    helpText += `${theme.primary.bold("Available examples:")}\n`;

    Object.entries(EXAMPLES_CONFIG).forEach(([name, config]) => {
      helpText += `  ${theme.success("•")} ${theme.bold(name)} ${theme.dim(
        `(${config.category})`
      )}\n`;
    });

    console.log(createInfoBox(helpText, "📚 Help"));
    process.exit(0);
  }

  if (args[0] === "--all") {
    generateAllDocs();
  } else {
    generateDocs(args[0]);
  }
}

main();
