/**
 * Declarative AI tool definition schema.
 *
 * A tool definition is plain data so it can come either from the built-in
 * registry or from a user-owned JSON file (~/.termly/tools.json).
 * Everything that used to be a hardcoded special case keyed on `tool.key`
 * (TUI mode, hidden-from-list, install hint) is now a field here.
 */

const path = require('path');
const {
  TOOL_KEY_PATTERN,
  TOOL_COMMAND_PATTERN,
  TOOL_ENV_KEY_PATTERN,
  MAX_TOOL_ARGS,
  MAX_TOOL_ENV_VARS
} = require('../config/constants');

// Fields a user config may set. Anything else is rejected so typos surface
// as errors instead of being silently ignored.
const ALLOWED_FIELDS = new Set([
  'key',
  'command',
  'args',
  'displayName',
  'description',
  'website',
  'env',
  'tui',
  'hidden',
  'install',
  'checkCommand',
  'versionArgs',
  'protocolKey'
]);

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// A command is either a bare executable name or an absolute/relative path.
// Shell metacharacters are rejected outright - commands are spawned with
// execFile/pty.spawn (no shell), so a metacharacter is always a mistake.
function isValidCommand(command) {
  if (typeof command !== 'string' || command.length === 0) {
    return false;
  }
  if (path.isAbsolute(command) || command.includes(path.sep)) {
    return !/[;&|`$<>\r\n"']/.test(command);
  }
  return TOOL_COMMAND_PATTERN.test(command);
}

function validateStringArray(value, field, errors, max) {
  if (!Array.isArray(value)) {
    errors.push(`"${field}" must be an array of strings`);
    return null;
  }
  if (value.length > max) {
    errors.push(`"${field}" must have at most ${max} entries`);
    return null;
  }
  const bad = value.findIndex(v => typeof v !== 'string');
  if (bad !== -1) {
    errors.push(`"${field}[${bad}]" must be a string`);
    return null;
  }
  return value.slice();
}

function validateEnv(value, errors) {
  if (!isPlainObject(value)) {
    errors.push('"env" must be an object of string values');
    return null;
  }
  const keys = Object.keys(value);
  if (keys.length > MAX_TOOL_ENV_VARS) {
    errors.push(`"env" must have at most ${MAX_TOOL_ENV_VARS} entries`);
    return null;
  }
  const env = {};
  for (const name of keys) {
    if (!TOOL_ENV_KEY_PATTERN.test(name)) {
      errors.push(`"env.${name}" is not a valid environment variable name`);
      continue;
    }
    if (typeof value[name] !== 'string') {
      errors.push(`"env.${name}" must be a string`);
      continue;
    }
    env[name] = value[name];
  }
  return env;
}

/**
 * Validate and normalize a tool definition.
 *
 * @param {object} def   Raw definition (from JSON or the built-in registry)
 * @param {object} opts  { source: 'builtin' | 'config', partial: boolean }
 * @returns {{ valid: boolean, errors: string[], tool: object|null }}
 */
function validateToolDefinition(def, opts = {}) {
  const { source = 'config', partial = false } = opts;
  const errors = [];

  if (!isPlainObject(def)) {
    return { valid: false, errors: ['tool definition must be an object'], tool: null };
  }

  for (const field of Object.keys(def)) {
    if (!ALLOWED_FIELDS.has(field)) {
      errors.push(`unknown field "${field}"`);
    }
  }

  const tool = {};

  // --- key ---------------------------------------------------------------
  if (!partial || def.key !== undefined) {
    if (typeof def.key !== 'string' || !TOOL_KEY_PATTERN.test(def.key)) {
      errors.push('"key" must be lowercase letters/digits/dashes (2-32 chars), e.g. "ollama-qwen"');
    } else {
      tool.key = def.key;
    }
  }

  // --- command -----------------------------------------------------------
  if (!partial || def.command !== undefined) {
    if (!isValidCommand(def.command)) {
      errors.push('"command" must be an executable name or path without shell metacharacters');
    } else {
      tool.command = def.command;
    }
  }

  // --- optional scalars --------------------------------------------------
  for (const field of ['displayName', 'description', 'website', 'install', 'protocolKey']) {
    if (def[field] === undefined) continue;
    if (typeof def[field] !== 'string') {
      errors.push(`"${field}" must be a string`);
    } else {
      tool[field] = def[field];
    }
  }

  if (def.checkCommand !== undefined) {
    if (!isValidCommand(def.checkCommand)) {
      errors.push('"checkCommand" must be an executable name or path without shell metacharacters');
    } else {
      tool.checkCommand = def.checkCommand;
    }
  }

  for (const field of ['tui', 'hidden']) {
    if (def[field] === undefined) continue;
    if (typeof def[field] !== 'boolean') {
      errors.push(`"${field}" must be true or false`);
    } else {
      tool[field] = def[field];
    }
  }

  // --- arrays / maps -----------------------------------------------------
  if (def.args !== undefined) {
    const args = validateStringArray(def.args, 'args', errors, MAX_TOOL_ARGS);
    if (args) tool.args = args;
  }

  if (def.versionArgs !== undefined) {
    const versionArgs = validateStringArray(def.versionArgs, 'versionArgs', errors, MAX_TOOL_ARGS);
    if (versionArgs) tool.versionArgs = versionArgs;
  }

  if (def.env !== undefined) {
    const env = validateEnv(def.env, errors);
    if (env) tool.env = env;
  }

  if (errors.length > 0) {
    return { valid: false, errors, tool: null };
  }

  tool.source = source;
  return { valid: true, errors: [], tool };
}

/**
 * Fill in defaults and attach the derived checkInstalled() probe.
 * Called once per tool after builtin + config layers have been merged.
 */
function normalizeTool(tool) {
  const { commandExists } = require('./probe');

  const normalized = {
    args: [],
    displayName: tool.key,
    description: '',
    website: '',
    tui: false,
    hidden: false,
    versionArgs: null,
    ...tool
  };

  normalized.checkCommand = normalized.checkCommand || normalized.command;
  normalized.protocolKey = normalized.protocolKey || normalized.key;

  // Built-in entries may already carry a bespoke checkInstalled(); keep it.
  if (typeof normalized.checkInstalled !== 'function') {
    normalized.checkInstalled = async () => await commandExists(normalized.checkCommand);
  }

  return normalized;
}

module.exports = {
  ALLOWED_FIELDS,
  isValidCommand,
  validateToolDefinition,
  normalizeTool
};
