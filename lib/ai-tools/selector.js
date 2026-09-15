const inquirer = require('inquirer');
const chalk = require('chalk');
const { detectInstalledTools, isToolInstalled } = require('./detector');
const { getToolByKey, getVisibleTools } = require('./registry');
const { getDefaultAI } = require('../config/manager');
const { getToolsFilePath } = require('./user-config');
const logger = require('../utils/logger');

// Print the tool keys that actually exist in this installation
// (built-ins + anything from ~/.termly/tools.json)
function printAvailableTools(stream = console.error) {
  const tools = getVisibleTools();

  stream('Available tools:');
  tools.forEach(tool => {
    const marker = tool.source === 'builtin' ? '' : chalk.gray(`  [${tool.source}]`);
    stream(`  • ${tool.key}${' '.repeat(Math.max(1, 18 - tool.key.length))}${tool.displayName}${marker}`);
  });
  stream('');
  stream(`Define your own in ${chalk.cyan(getToolsFilePath())} (${chalk.cyan('termly tools init')})`);
}

// Select AI tool based on options
async function selectAITool(options) {
  // 1. Manual selection via --ai flag
  if (options.ai) {
    logger.debug(`Manual tool selection: ${options.ai}`);
    return await selectManualTool(options.ai);
  }

  // 2. Configured default (termly config set defaultAI <tool>)
  const configuredTool = await selectConfiguredDefault();
  if (configuredTool) {
    return configuredTool;
  }

  // 3. No auto-detect mode
  if (options.noAutoDetect) {
    console.error(chalk.red('❌ Please specify AI tool with --ai flag'));
    console.error('');
    console.error('Examples:');
    console.error('  termly start --ai aider');
    console.error('  termly start --ai "claude code"');
    console.error('');
    process.exit(1);
  }

  // 4. Auto-detect mode
  return await autoSelectTool();
}

// Configured default tool selection
//
// Unlike --ai, `defaultAI` is a stored preference that may have been set long
// ago, so a stale value must never kill `termly start`: warn and let the caller
// fall back to auto-detection.
async function selectConfiguredDefault() {
  const defaultAI = getDefaultAI();

  if (!defaultAI) {
    return null;
  }

  logger.debug(`Configured defaultAI: ${defaultAI}`);

  const tool = getToolByKey(defaultAI);

  if (!tool) {
    logger.warn(`Configured default AI "${defaultAI}" is unknown - falling back to auto-detection`);
    console.log(chalk.dim('   Change it with: termly config set defaultAI <tool>'));
    return null;
  }

  const result = await isToolInstalled(tool.key);

  if (!result.installed) {
    logger.warn(`Configured default AI ${tool.displayName} is not installed - falling back to auto-detection`);
    console.log(chalk.dim('   Change it with: termly config set defaultAI <tool>'));
    return null;
  }

  console.log(chalk.green(`Using ${result.tool.displayName} v${result.tool.version} (configured default)`));
  return result.tool;
}

// Manual tool selection
async function selectManualTool(toolName) {
  const tool = getToolByKey(toolName);

  if (!tool) {
    console.error(chalk.red(`❌ Unknown AI tool: ${toolName}`));
    console.error('');
    printAvailableTools();
    process.exit(1);
  }

  const result = await isToolInstalled(tool.key);

  if (!result.installed) {
    console.error(chalk.red(`❌ ${tool.displayName} is not installed`));
    console.error('');
    console.error(`Install it:`);
    console.error(`  ${getInstallInstructions(tool)}`);
    console.error('');
    console.error(chalk.gray(`  (looked for command: ${tool.checkCommand})`));
    console.error('');
    console.error('Or use auto-detection:');
    console.error('  termly start');
    process.exit(1);
  }

  console.log(chalk.green(`Using ${result.tool.displayName} v${result.tool.version}`));
  return result.tool;
}

// Auto-detect and select tool
async function autoSelectTool() {
  logger.debug('Auto-detecting AI tools...');

  const installedTools = await detectInstalledTools();

  if (installedTools.length === 0) {
    console.error(chalk.red('❌ No AI tools detected'));
    console.error('');
    console.error('Please install an AI coding assistant:');
    printAvailableTools();
    console.error('Then try again: termly start');
    console.error('');
    console.error(chalk.dim('Or try demo mode (no installation required):'));
    console.error(chalk.cyan('  termly start --ai demo'));
    process.exit(1);
  }

  if (installedTools.length === 1) {
    const tool = installedTools[0];
    console.log(chalk.green(`✓ Using ${tool.displayName} v${tool.version} (auto-detected)`));
    return tool;
  }

  // Multiple tools found - ask user
  console.log(chalk.yellow('Multiple AI tools detected:'));
  console.log('');

  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'tool',
      message: 'Which tool would you like to use?',
      choices: installedTools.map(t => ({
        name: `${t.displayName} (${t.command}) - v${t.version}`,
        value: t.key
      }))
    }
  ]);

  const selectedTool = installedTools.find(t => t.key === answer.tool);
  console.log(chalk.green(`✓ Using ${selectedTool.displayName} v${selectedTool.version}`));

  return selectedTool;
}

// Get installation instructions for a tool.
// Built-ins carry `install` in the registry; config-defined tools can set it too.
function getInstallInstructions(tool) {
  return tool.install || tool.website || `(no install instructions for "${tool.key}")`;
}

module.exports = {
  selectAITool,
  selectManualTool,
  autoSelectTool,
  getInstallInstructions,
  printAvailableTools
};
