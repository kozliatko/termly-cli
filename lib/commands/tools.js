const chalk = require('chalk');
const { getVisibleTools, getToolByKey } = require('../ai-tools/registry');
const { detectInstalledTools } = require('../ai-tools/detector');
const { getInstallInstructions } = require('../ai-tools/selector');
const {
  loadUserTools,
  getToolsFilePath,
  initToolsFile,
  SUPPORTED_VERSION
} = require('../ai-tools/user-config');

// Short tag showing where a tool definition came from
function sourceTag(tool) {
  if (tool.source === 'builtin') return '';
  return chalk.magenta(` [${tool.source}]`);
}

async function toolsListCommand() {
  console.log(chalk.bold('Available AI Tools:'));
  console.log('');

  // Hidden tools (demo mode) are excluded here
  const allTools = getVisibleTools();
  const installedTools = await detectInstalledTools();

  const installedKeys = new Set(installedTools.map(t => t.key));

  for (const tool of allTools) {
    const isInstalled = installedKeys.has(tool.key);
    const icon = isInstalled ? chalk.green('✓') : chalk.red('✗');
    const status = isInstalled ? chalk.green('installed') : chalk.gray('not installed');

    const installedTool = installedTools.find(t => t.key === tool.key);
    const version = installedTool ? ` v${installedTool.version}` : '';

    console.log(`  ${icon} ${chalk.bold(tool.displayName)} (${tool.command})${version} - ${status}${sourceTag(tool)}`);
  }

  console.log('');
  console.log(`Use ${chalk.cyan('termly start --ai <tool>')} to use a specific tool`);
  console.log(`Add your own with ${chalk.cyan('termly tools init')} → ${chalk.gray(getToolsFilePath())}`);
}

async function toolsDetectCommand() {
  console.log(chalk.bold('🔍 Detecting installed AI tools...'));
  console.log('');

  const installedTools = await detectInstalledTools();

  if (installedTools.length === 0) {
    console.log(chalk.yellow('No AI tools found'));
    console.log('');
    console.log('Install an AI coding assistant:');
    console.log('  • Claude Code: https://docs.claude.com');
    console.log('  • Aider: pip install aider-chat');
    console.log('  • GitHub Copilot: gh extension install github/gh-copilot');
    return;
  }

  console.log(chalk.green(`Found ${installedTools.length} AI tool${installedTools.length > 1 ? 's' : ''}:`));
  console.log('');

  installedTools.forEach(tool => {
    console.log(`  • ${chalk.bold(tool.displayName)} v${tool.version}${sourceTag(tool)}`);
  });

  console.log('');
  if (installedTools.length === 1) {
    console.log(chalk.cyan(`Recommended: ${installedTools[0].displayName}`));
  }
}

async function toolsInfoCommand(toolName) {
  if (!toolName) {
    console.error(chalk.red('Please specify a tool name'));
    console.error('');
    console.error(`Usage: ${chalk.cyan('termly tools info <tool-name>')}`);
    return;
  }

  const tool = getToolByKey(toolName);

  if (!tool) {
    console.error(chalk.red(`Unknown tool: ${toolName}`));
    console.error('');
    console.error(`Use ${chalk.cyan('termly tools list')} to see available tools`);
    return;
  }

  console.log(chalk.bold(tool.displayName));
  console.log('─'.repeat(tool.displayName.length));
  console.log(`${chalk.gray('Key:')}         ${tool.key}`);
  console.log(`${chalk.gray('Command:')}     ${tool.command}${tool.args.length ? ' ' + tool.args.join(' ') : ''}`);
  console.log(`${chalk.gray('Description:')} ${tool.description}`);
  console.log(`${chalk.gray('Website:')}     ${tool.website}`);
  console.log(`${chalk.gray('Defined by:')}  ${tool.source}`);

  if (tool.checkCommand !== tool.command) {
    console.log(`${chalk.gray('Detected via:')} ${tool.checkCommand}`);
  }
  if (tool.protocolKey !== tool.key) {
    console.log(`${chalk.gray('Reports as:')}  ${tool.protocolKey}`);
  }
  if (tool.tui) {
    console.log(`${chalk.gray('TUI mode:')}    yes (alternate screen buffer)`);
  }
  if (tool.env && Object.keys(tool.env).length > 0) {
    console.log(`${chalk.gray('Environment:')} ${Object.keys(tool.env).join(', ')}`);
  }

  const { isToolInstalled } = require('../ai-tools/detector');
  const result = await isToolInstalled(tool.key);

  if (result.installed) {
    console.log(`${chalk.gray('Installed:')}   ${chalk.green('✓ Yes')} (v${result.tool.version})`);
  } else {
    console.log(`${chalk.gray('Installed:')}   ${chalk.red('✗ No')} - ${getInstallInstructions(tool)}`);
  }

  console.log('');
  console.log(chalk.bold('Example usage:'));
  console.log(chalk.cyan(`  termly start --ai ${tool.key}`));

  if (tool.key === 'aider') {
    console.log(chalk.cyan(`  termly start --ai ${tool.key} --ai-args "--model gpt-4"`));
  }
}

// Show the state of ~/.termly/tools.json
async function toolsConfigCommand() {
  const result = loadUserTools();

  console.log(chalk.bold('Custom AI Tools Config'));
  console.log('');
  console.log(`${chalk.gray('File:')}    ${result.path}`);
  console.log(`${chalk.gray('Status:')}  ${result.exists ? chalk.green('found') : chalk.gray('not created yet')}`);
  console.log(`${chalk.gray('Schema:')}  version ${SUPPORTED_VERSION}`);
  console.log('');

  if (!result.exists) {
    console.log(`Create it with ${chalk.cyan('termly tools init')}`);
    return;
  }

  if (result.tools.length > 0) {
    console.log(chalk.bold('Custom tools:'));
    result.tools.forEach(t => console.log(`  • ${t.key} → ${t.command} ${(t.args || []).join(' ')}`.trimEnd()));
    console.log('');
  }

  const overrideKeys = Object.keys(result.overrides);
  if (overrideKeys.length > 0) {
    console.log(chalk.bold('Overrides:'));
    overrideKeys.forEach(k => console.log(`  • ${k}: ${Object.keys(result.overrides[k]).join(', ')}`));
    console.log('');
  }

  if (result.errors.length > 0) {
    console.log(chalk.red(`${result.errors.length} problem(s):`));
    result.errors.forEach(e => console.log(chalk.red(`  • ${e}`)));
    console.log('');
    console.log(chalk.gray('Invalid entries are skipped; the rest of the file still loads.'));
  } else if (result.tools.length === 0 && overrideKeys.length === 0) {
    console.log(chalk.gray('File is valid but defines no tools or overrides.'));
  } else {
    console.log(chalk.green('✓ Config is valid'));
  }
}

// Validate without printing the whole config (exit code friendly)
async function toolsValidateCommand() {
  const result = loadUserTools();

  if (!result.exists) {
    console.log(chalk.gray(`No config file at ${result.path} - using built-in tools only`));
    return;
  }

  if (result.errors.length === 0) {
    console.log(chalk.green(`✓ ${result.path} is valid`));
    console.log(chalk.gray(`  ${result.tools.length} tool(s), ${Object.keys(result.overrides).length} override(s)`));
    return;
  }

  console.error(chalk.red(`✗ ${result.path} has ${result.errors.length} problem(s):`));
  result.errors.forEach(e => console.error(chalk.red(`  • ${e}`)));
  process.exitCode = 1;
}

// Scaffold an example config file
async function toolsInitCommand() {
  const { created, path: filePath } = initToolsFile();

  if (!created) {
    console.log(chalk.yellow(`Config already exists: ${filePath}`));
    console.log(`Inspect it with ${chalk.cyan('termly tools config')}`);
    return;
  }

  console.log(chalk.green(`✓ Created ${filePath}`));
  console.log('');
  console.log('It contains a worked example. Edit it, then run:');
  console.log(chalk.cyan('  termly tools validate'));
  console.log(chalk.cyan('  termly tools list'));
}

async function toolsCommand(action, toolName) {
  switch (action) {
    case 'list':
      await toolsListCommand();
      break;

    case 'detect':
      await toolsDetectCommand();
      break;

    case 'info':
      await toolsInfoCommand(toolName);
      break;

    case 'config':
      await toolsConfigCommand();
      break;

    case 'validate':
      await toolsValidateCommand();
      break;

    case 'init':
      await toolsInitCommand();
      break;

    default:
      console.error(chalk.red(`Unknown action: ${action}`));
      console.error('');
      console.error('Available actions:');
      console.error(chalk.cyan('  termly tools list'));
      console.error(chalk.cyan('  termly tools detect'));
      console.error(chalk.cyan('  termly tools info <tool-name>'));
      console.error(chalk.cyan('  termly tools init'));
      console.error(chalk.cyan('  termly tools config'));
      console.error(chalk.cyan('  termly tools validate'));
  }
}

module.exports = toolsCommand;
