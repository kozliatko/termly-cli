/**
 * Application constants
 *
 * All magic numbers and configuration values should be defined here.
 */

module.exports = {
  // Network & WebSocket
  HEARTBEAT_TIMEOUT: 13000,        // 13s - detect network loss (server pings every ~5s)
  CLI_IDLE_THRESHOLD: 15000,       // 15s - no PTY output = CLI is idle

  // PTY & Terminal
  RESTORE_RESIZE_DELAY: 2000,      // 2s - delay before restoring terminal size after mobile disconnect

  // Buffer
  DEFAULT_BUFFER_SIZE: 100000,     // 100KB - circular buffer max size

  // Reconnection
  MAX_RECONNECT_ATTEMPTS: 10,      // Max WebSocket reconnection attempts

  // AI tool definitions (built-in registry + ~/.termly/tools.json)
  TOOL_PROBE_TIMEOUT: 5000,        // 5s - max time for a `--version` / existence probe
  MAX_TOOL_ARGS: 32,               // Max args/versionArgs entries per tool definition
  MAX_TOOL_ENV_VARS: 32,           // Max env entries per tool definition
  MAX_TOOLS_CONFIG_BYTES: 262144,  // 256KB - max size of a tools.json file
  TOOL_KEY_PATTERN: /^[a-z0-9][a-z0-9-]{1,31}$/,
  TOOL_COMMAND_PATTERN: /^[A-Za-z0-9._-]{1,64}$/,
  TOOL_ENV_KEY_PATTERN: /^[A-Za-z_][A-Za-z0-9_]{0,63}$/,
};
