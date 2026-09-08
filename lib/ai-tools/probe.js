/**
 * Command probing for AI tools (existence + version).
 *
 * These helpers never build a shell command string. Tool commands can now come
 * from a user-editable config file, so every probe goes through execFile with
 * the command passed as an argv entry - a value like `foo; rm -rf ~` is treated
 * as a (missing) executable name, never as shell syntax.
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { TOOL_PROBE_TIMEOUT } = require('../config/constants');

const isWindows = process.platform === 'win32';

// Check if a command is resolvable on PATH
async function commandExists(command) {
  if (!command) {
    return false;
  }

  try {
    if (isWindows) {
      await execFileAsync('where', [command], { timeout: TOOL_PROBE_TIMEOUT });
    } else {
      // `command -v` is a shell builtin, so we do need sh - but the candidate is
      // passed as $1 rather than interpolated into the script text.
      await execFileAsync('sh', ['-c', 'command -v -- "$1" >/dev/null 2>&1', 'sh', command], {
        timeout: TOOL_PROBE_TIMEOUT
      });
    }
    return true;
  } catch {
    return false;
  }
}

// Run `<command> <args>` and return combined stdout+stderr, or null on failure
async function runProbe(command, args) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: TOOL_PROBE_TIMEOUT,
      windowsHide: true
    });
    return `${stdout || ''}${stderr || ''}`;
  } catch (err) {
    // Many CLIs exit non-zero on --version but still print it
    if (err && (err.stdout || err.stderr)) {
      return `${err.stdout || ''}${err.stderr || ''}`;
    }
    return null;
  }
}

// Parse a version number out of arbitrary CLI output
function parseVersion(output) {
  if (!output) {
    return 'unknown';
  }

  const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
  if (versionMatch) {
    return versionMatch[1];
  }

  const simpleMatch = output.match(/(\d+\.\d+)/);
  if (simpleMatch) {
    return simpleMatch[1];
  }

  return 'unknown';
}

// Get tool version, trying the tool's own versionArgs then the usual suspects
async function getToolVersion(tool) {
  const candidates = tool.versionArgs && tool.versionArgs.length > 0
    ? [tool.versionArgs]
    : [['--version'], ['-v']];

  for (const args of candidates) {
    const output = await runProbe(tool.command, args);
    const version = parseVersion(output);
    if (version !== 'unknown') {
      return version;
    }
  }

  return 'unknown';
}

module.exports = {
  commandExists,
  getToolVersion,
  parseVersion,
  runProbe
};
