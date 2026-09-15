/**
 * User-defined AI tools (~/.termly/tools.json).
 *
 * Lets people add a new AI CLI or model variant - or repoint a built-in one -
 * without waiting for a Termly release. Loading is deliberately fail-soft: a
 * broken file produces warnings and is ignored, it never blocks `termly start`.
 *
 * Only the user's own home directory is read. Project-local tool files are NOT
 * supported on purpose: cloning a repo must never be able to make Termly spawn
 * an attacker-chosen command.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateToolDefinition } = require('./schema');
const { MAX_TOOLS_CONFIG_BYTES } = require('../config/constants');
const logger = require('../utils/logger');

const DEFAULT_TOOLS_FILE = path.join(os.homedir(), '.termly', 'tools.json');
const SUPPORTED_VERSION = 1;

// Resolve which file to read
function getToolsFilePath() {
  return process.env.TERMLY_TOOLS_FILE || DEFAULT_TOOLS_FILE;
}

function emptyResult(filePath, errors = []) {
  return { path: filePath, exists: false, tools: [], overrides: {}, errors };
}

/**
 * Read and validate the user tools file.
 * @returns {{path: string, exists: boolean, tools: object[], overrides: object, errors: string[]}}
 */
function loadUserTools() {
  const filePath = getToolsFilePath();
  const errors = [];

  let raw;
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_TOOLS_CONFIG_BYTES) {
      return emptyResult(filePath, [`file is larger than ${MAX_TOOLS_CONFIG_BYTES} bytes`]);
    }
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') {
      return emptyResult(filePath, [`cannot read file: ${err.message}`]);
    }
    return emptyResult(filePath);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ...emptyResult(filePath), exists: true, errors: [`invalid JSON: ${err.message}`] };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ...emptyResult(filePath), exists: true, errors: ['top level must be a JSON object'] };
  }

  if (parsed.version !== undefined && parsed.version !== SUPPORTED_VERSION) {
    errors.push(`unsupported "version": ${JSON.stringify(parsed.version)} (expected ${SUPPORTED_VERSION})`);
  }

  // --- tools[] : new definitions (or full replacement of a built-in) ------
  const tools = [];
  const seenKeys = new Set();

  if (parsed.tools !== undefined) {
    if (!Array.isArray(parsed.tools)) {
      errors.push('"tools" must be an array');
    } else {
      parsed.tools.forEach((def, index) => {
        const result = validateToolDefinition(def, { source: 'config' });
        if (!result.valid) {
          result.errors.forEach(e => errors.push(`tools[${index}]: ${e}`));
          return;
        }
        if (seenKeys.has(result.tool.key)) {
          errors.push(`tools[${index}]: duplicate key "${result.tool.key}"`);
          return;
        }
        seenKeys.add(result.tool.key);
        tools.push(result.tool);
      });
    }
  }

  // --- overrides{} : patch fields of an existing built-in ----------------
  const overrides = {};

  if (parsed.overrides !== undefined) {
    if (typeof parsed.overrides !== 'object' || parsed.overrides === null || Array.isArray(parsed.overrides)) {
      errors.push('"overrides" must be an object keyed by tool key');
    } else {
      for (const [key, patch] of Object.entries(parsed.overrides)) {
        const result = validateToolDefinition(patch, { source: 'config', partial: true });
        if (!result.valid) {
          result.errors.forEach(e => errors.push(`overrides.${key}: ${e}`));
          continue;
        }
        if (result.tool.key && result.tool.key !== key) {
          errors.push(`overrides.${key}: "key" cannot be changed (got "${result.tool.key}")`);
          continue;
        }
        delete result.tool.key;
        delete result.tool.source;
        overrides[key] = result.tool;
      }
    }
  }

  return { path: filePath, exists: true, tools, overrides, errors };
}

// Load and log warnings once (used by the registry on first build)
function loadUserToolsWithWarnings() {
  const result = loadUserTools();

  if (result.errors.length > 0) {
    logger.warn(`Ignoring invalid entries in ${result.path}:`);
    result.errors.forEach(e => logger.warn(`  • ${e}`));
  }

  if (result.exists) {
    logger.debug(
      `Loaded ${result.tools.length} custom tool(s) and ` +
      `${Object.keys(result.overrides).length} override(s) from ${result.path}`
    );
  }

  return result;
}

// Example file written by `termly tools init`
const EXAMPLE_CONFIG = {
  version: SUPPORTED_VERSION,
  tools: [
    {
      key: 'ollama-qwen',
      command: 'ollama',
      args: ['run', 'qwen2.5-coder:32b'],
      displayName: 'Ollama - Qwen2.5 Coder 32B',
      description: 'Local Qwen2.5-Coder model served by Ollama',
      website: 'https://ollama.ai',
      install: 'https://ollama.ai/download',
      env: { OLLAMA_HOST: 'http://127.0.0.1:11434' },
      checkCommand: 'ollama',
      protocolKey: 'ollama'
    }
  ],
  overrides: {
    'claude-code': {
      description: 'Anthropic Claude Code (Opus by default)',
      env: { ANTHROPIC_MODEL: 'claude-opus-5' }
    }
  }
};

// Create the tools file with a commented example if it does not exist yet
function initToolsFile() {
  const filePath = getToolsFilePath();

  if (fs.existsSync(filePath)) {
    return { created: false, path: filePath };
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(EXAMPLE_CONFIG, null, 2) + '\n', { mode: 0o600 });

  return { created: true, path: filePath };
}

module.exports = {
  DEFAULT_TOOLS_FILE,
  SUPPORTED_VERSION,
  EXAMPLE_CONFIG,
  getToolsFilePath,
  loadUserTools,
  loadUserToolsWithWarnings,
  initToolsFile
};
