/**
 * AI tools registry.
 *
 * The built-in table below ships with Termly. At runtime it is merged with the
 * user's own definitions from ~/.termly/tools.json (see ./user-config.js), so
 * new AI CLIs and model variants can be added without a Termly release.
 *
 * Merge order (later wins):
 *   1. BUILTIN_AI_TOOLS
 *   2. config "overrides"  - patch individual fields of a built-in
 *   3. config "tools"      - add a new tool, or fully replace a built-in by key
 */

const { commandExists, getToolVersion, parseVersion } = require('./probe');
const { normalizeTool } = require('./schema');
const { loadUserToolsWithWarnings } = require('./user-config');

// Built-in AI Tools Registry
const BUILTIN_AI_TOOLS = {
  'claude-code': {
    key: 'claude-code',
    command: 'claude',
    args: [],
    displayName: 'Claude Code',
    description: 'Anthropic\'s AI coding assistant',
    website: 'https://docs.claude.com',
    install: 'https://docs.claude.com'
  },
  'flaude': {
    key: 'flaude',
    command: 'flaude',
    args: [],
    displayName: 'Flaude',
    description: 'Claude Code launched under the "flaude" command (aliased/renamed default AI)',
    website: 'https://docs.claude.com',
    install: 'https://docs.claude.com',
    protocolKey: 'claude-code'
  },
  'aider': {
    key: 'aider',
    command: 'aider',
    args: [],
    displayName: 'Aider',
    description: 'AI pair programming in your terminal',
    website: 'https://aider.chat',
    install: 'pip install aider-chat'
  },
  'codex': {
    key: 'codex',
    command: 'codex',
    args: [],
    displayName: 'OpenAI Codex CLI',
    description: 'Official OpenAI Codex CLI (launched April 2025)',
    website: 'https://openai.com/codex'
  },
  'github-copilot': {
    key: 'github-copilot',
    command: 'copilot',
    args: [],
    displayName: 'GitHub Copilot CLI',
    description: 'GitHub\'s command line AI',
    website: 'https://github.com/features/copilot',
    install: 'gh extension install github/gh-copilot'
  },
  'cody': {
    key: 'cody',
    command: 'cody',
    args: ['chat'],
    displayName: 'Cody CLI',
    description: 'Sourcegraph\'s AI assistant (Beta)',
    website: 'https://sourcegraph.com/cody',
    install: 'npm install -g @sourcegraph/cody'
  },
  'gemini': {
    key: 'gemini',
    command: 'gemini',
    args: [],
    displayName: 'Google Gemini CLI',
    description: 'Official Google Gemini CLI with 1M token context',
    website: 'https://developers.google.com/gemini-code-assist'
  },
  'continue': {
    key: 'continue',
    command: 'cn',
    args: [],
    displayName: 'Continue CLI',
    description: 'Open-source modular AI coding assistant',
    website: 'https://continue.dev',
    install: 'npm install -g continue-dev'
  },
  'cursor': {
    key: 'cursor',
    command: 'cursor-agent',
    args: [],
    displayName: 'Cursor Agent CLI',
    description: 'Cursor\'s AI coding assistant CLI (Beta)',
    website: 'https://cursor.com/blog/cli',
    install: 'https://cursor.com/blog/cli'
  },
  'chatgpt': {
    key: 'chatgpt',
    command: 'chatgpt',
    args: [],
    displayName: 'ChatGPT CLI',
    description: 'ChatGPT in your terminal (Go implementation)',
    website: 'https://github.com/j178/chatgpt'
  },
  'sgpt': {
    key: 'sgpt',
    command: 'sgpt',
    args: ['--repl', 'temp'],
    displayName: 'ShellGPT',
    description: 'ChatGPT-powered shell assistant with REPL mode',
    website: 'https://github.com/TheR1D/shell_gpt'
  },
  'mentat': {
    key: 'mentat',
    command: 'mentat',
    args: [],
    displayName: 'Mentat',
    description: 'AI coding assistant with Git integration',
    website: 'https://www.mentat.ai'
  },
  'grok': {
    key: 'grok',
    command: 'grok',
    args: [],
    displayName: 'Grok CLI',
    description: 'xAI\'s Grok AI assistant (by Elon Musk)',
    website: 'https://grok.x.ai'
  },
  'ollama': {
    key: 'ollama',
    command: 'ollama',
    args: ['run', 'codellama'],
    displayName: 'Ollama',
    description: 'Run LLMs locally (CodeLlama, Llama, etc)',
    website: 'https://ollama.ai',
    install: 'https://ollama.ai/download'
  },
  'openhands': {
    key: 'openhands',
    command: 'openhands',
    args: [],
    displayName: 'OpenHands',
    description: 'Open-source AI software engineer (formerly OpenDevin)',
    website: 'https://github.com/All-Hands-AI/OpenHands'
  },
  'opencode': {
    key: 'opencode',
    command: 'opencode',
    args: [],
    displayName: 'OpenCode',
    description: 'Open-source AI coding agent with LSP integration and 75+ LLM providers',
    website: 'https://opencode.ai',
    tui: true
  },
  'blackbox': {
    key: 'blackbox',
    command: 'blackboxai',
    args: [],
    displayName: 'Blackbox AI',
    description: 'AI coding assistant with debugging & file editing',
    website: 'https://blackbox.ai'
  },
  'amazon-q': {
    key: 'amazon-q',
    command: 'q',
    args: [],
    displayName: 'Amazon Q Developer',
    description: 'AWS\'s AI coding companion with free tier',
    website: 'https://aws.amazon.com/q/developer'
  },
  'pi': {
    key: 'pi',
    command: 'pi',
    args: [],
    displayName: 'Pi Coding Agent',
    description: 'Minimal AI coding agent with extensions, skills, and 15+ LLM providers',
    website: 'https://shittycodingagent.ai'
  },
  'kilo': {
    key: 'kilo',
    command: 'kilo',
    args: [],
    displayName: 'Kilo Code CLI',
    description: 'Agentic engineering CLI with 500+ models and parallel mode',
    website: 'https://kilo.ai',
    tui: true
  },
  'qwen': {
    key: 'qwen',
    command: 'qwen',
    args: [],
    displayName: 'Qwen Code',
    description: 'Alibaba\'s agentic coding CLI optimized for Qwen3-Coder models',
    website: 'https://github.com/QwenLM/qwen-code'
  },
  'demo': {
    key: 'demo',
    command: 'node',
    args: [require('path').join(__dirname, 'demo', 'index.js')],
    displayName: 'Demo Mode',
    description: 'Interactive demo for testing (no AI installation required)',
    website: 'https://termly.dev',
    hidden: true,                       // excluded from auto-detect and `tools list`
    checkInstalled: async () => true    // always available
  }
};

// Merged registry cache (built lazily on first access)
let registryCache = null;

// Build the effective registry: builtins <- overrides <- user tools
function buildRegistry() {
  const merged = {};

  for (const [key, tool] of Object.entries(BUILTIN_AI_TOOLS)) {
    merged[key] = { ...tool, source: 'builtin' };
  }

  const userConfig = loadUserToolsWithWarnings();

  // 2. Patch built-ins field by field
  for (const [key, patch] of Object.entries(userConfig.overrides)) {
    if (!merged[key]) {
      const logger = require('../utils/logger');
      logger.warn(`Ignoring override for unknown tool "${key}" in ${userConfig.path}`);
      continue;
    }
    merged[key] = { ...merged[key], ...patch, key, source: 'builtin+config' };
  }

  // 3. Add (or fully replace) tools
  for (const tool of userConfig.tools) {
    merged[tool.key] = { ...tool, source: merged[tool.key] ? 'config (replaces builtin)' : 'config' };
  }

  for (const key of Object.keys(merged)) {
    merged[key] = normalizeTool(merged[key]);
  }

  return merged;
}

// Get the merged registry (memoized)
function getRegistry() {
  if (!registryCache) {
    registryCache = buildRegistry();
  }
  return registryCache;
}

// Drop the cache so the next access re-reads ~/.termly/tools.json
function resetRegistry() {
  registryCache = null;
}

// Get tool by key
function getToolByKey(key) {
  if (typeof key !== 'string') {
    return null;
  }

  const registry = getRegistry();

  // Normalize key
  const normalizedKey = key.toLowerCase().replace(/\s+/g, '-');

  // Try exact match
  if (registry[normalizedKey]) {
    return registry[normalizedKey];
  }

  // Try fuzzy match
  for (const tool of Object.values(registry)) {
    if (tool.displayName.toLowerCase() === key.toLowerCase()) {
      return tool;
    }
    if (tool.command === key) {
      return tool;
    }
  }

  return null;
}

// Get all tools
function getAllTools() {
  return Object.values(getRegistry());
}

// Get all tools that should show up in listings and auto-detection
function getVisibleTools() {
  return getAllTools().filter(tool => !tool.hidden);
}

module.exports = {
  BUILTIN_AI_TOOLS,
  buildRegistry,
  getRegistry,
  resetRegistry,
  commandExists,
  getToolVersion,
  parseVersion,
  getToolByKey,
  getAllTools,
  getVisibleTools,
  // Backwards compatibility: `AI_TOOLS` used to be the raw builtin map.
  get AI_TOOLS() {
    return getRegistry();
  }
};
