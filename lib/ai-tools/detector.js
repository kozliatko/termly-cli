const { getVisibleTools, getToolVersion } = require('./registry');
const logger = require('../utils/logger');

// Detect all installed AI tools
async function detectInstalledTools() {
  // Hidden tools (e.g. demo mode) are excluded from auto-detection;
  // they are only reachable via an explicit --ai flag.
  const candidates = getVisibleTools();
  const installedTools = [];

  logger.debug('Detecting installed AI tools...');

  for (const tool of candidates) {
    try {
      const isInstalled = await tool.checkInstalled();

      if (isInstalled) {
        const version = await getToolVersion(tool);

        // Always use short command name - PTY will have npm bin in PATH
        installedTools.push({
          ...tool,
          version,
          installed: true
        });

        logger.debug(`Found: ${tool.displayName} v${version} (command: ${tool.command}, source: ${tool.source})`);
      }
    } catch (err) {
      logger.debug(`Check failed for ${tool.displayName}: ${err.message}`);
    }
  }

  logger.debug(`Detected ${installedTools.length} installed AI tools`);

  return installedTools;
}

// Check if specific tool is installed
async function isToolInstalled(toolKey) {
  const { getToolByKey } = require('./registry');
  const tool = getToolByKey(toolKey);

  if (!tool) {
    return { installed: false, error: 'Unknown tool' };
  }

  try {
    const isInstalled = await tool.checkInstalled();

    if (isInstalled) {
      const version = await getToolVersion(tool);

      // Always use short command name - PTY will have npm bin in PATH
      return {
        installed: true,
        tool: {
          ...tool,
          version
        }
      };
    }

    return { installed: false, tool };
  } catch (err) {
    return { installed: false, tool, error: err.message };
  }
}

module.exports = {
  detectInstalledTools,
  isToolInstalled
};
