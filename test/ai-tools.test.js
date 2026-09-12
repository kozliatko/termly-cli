const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { validateToolDefinition, isValidCommand } = require('../lib/ai-tools/schema');
const { commandExists, parseVersion } = require('../lib/ai-tools/probe');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'termly-test-'));

// Point the loader at a scratch file and re-read the registry
function withConfig(contents, fn) {
  const file = path.join(TMP, `tools-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(file, typeof contents === 'string' ? contents : JSON.stringify(contents));

  const prev = process.env.TERMLY_TOOLS_FILE;
  process.env.TERMLY_TOOLS_FILE = file;

  // Registry memoizes; drop the cache so the new file is picked up
  const registry = require('../lib/ai-tools/registry');
  registry.resetRegistry();

  try {
    return fn(registry, file);
  } finally {
    registry.resetRegistry();
    if (prev === undefined) delete process.env.TERMLY_TOOLS_FILE;
    else process.env.TERMLY_TOOLS_FILE = prev;
  }
}

test('isValidCommand rejects shell metacharacters', () => {
  assert.ok(isValidCommand('claude'));
  assert.ok(isValidCommand('cursor-agent'));
  assert.ok(isValidCommand('/usr/local/bin/claude'));
  assert.ok(!isValidCommand('claude; rm -rf ~'));
  assert.ok(!isValidCommand('sh -c "curl x | sh"'));
  assert.ok(!isValidCommand('$(whoami)'));
  assert.ok(!isValidCommand(''));
  assert.ok(!isValidCommand(undefined));
});

test('commandExists never evaluates shell syntax', async () => {
  assert.equal(await commandExists('node'), true);
  assert.equal(await commandExists('node; echo pwned'), false);
  assert.equal(await commandExists('definitely-not-installed-xyz'), false);
});

test('parseVersion extracts semver-ish versions', () => {
  assert.equal(parseVersion('claude 2.1.263 (build 9)'), '2.1.263');
  assert.equal(parseVersion('v1.9'), '1.9');
  assert.equal(parseVersion('no numbers here'), 'unknown');
  assert.equal(parseVersion(null), 'unknown');
});

test('validateToolDefinition accepts a minimal definition', () => {
  const r = validateToolDefinition({ key: 'my-agent', command: 'my-agent' });
  assert.ok(r.valid, r.errors.join('; '));
  assert.equal(r.tool.key, 'my-agent');
});

test('validateToolDefinition rejects unknown fields and bad types', () => {
  const r = validateToolDefinition({ key: 'x-agent', command: 'ok', tuiMode: true, args: 'nope' });
  assert.ok(!r.valid);
  assert.ok(r.errors.some(e => e.includes('unknown field "tuiMode"')));
  assert.ok(r.errors.some(e => e.includes('"args" must be an array')));
});

test('validateToolDefinition rejects invalid env names and values', () => {
  const r = validateToolDefinition({ key: 'x-agent', command: 'ok', env: { 'bad-name': 'v', GOOD: 1 } });
  assert.ok(!r.valid);
  assert.equal(r.errors.length, 2);
});

test('config tools are added to the registry', () => {
  withConfig({
    version: 1,
    tools: [{ key: 'ollama-qwen', command: 'ollama', args: ['run', 'qwen'], displayName: 'Qwen via Ollama' }]
  }, (registry) => {
    const tool = registry.getToolByKey('ollama-qwen');
    assert.ok(tool);
    assert.equal(tool.command, 'ollama');
    assert.deepEqual(tool.args, ['run', 'qwen']);
    assert.equal(tool.source, 'config');
    assert.equal(typeof tool.checkInstalled, 'function');
  });
});

test('overrides patch a builtin without replacing it', () => {
  withConfig({
    version: 1,
    overrides: { 'claude-code': { command: 'flaude', env: { ANTHROPIC_MODEL: 'claude-opus-5' } } }
  }, (registry) => {
    const tool = registry.getToolByKey('claude-code');
    assert.equal(tool.command, 'flaude');
    assert.equal(tool.displayName, 'Claude Code');       // untouched
    assert.equal(tool.env.ANTHROPIC_MODEL, 'claude-opus-5');
    assert.equal(tool.source, 'builtin+config');
  });
});

test('overrides cannot rename a tool key', () => {
  withConfig({ version: 1, overrides: { aider: { key: 'something-else' } } }, (registry) => {
    assert.ok(registry.getToolByKey('aider'));
    assert.equal(registry.getToolByKey('something-else'), null);
  });
});

test('a broken config never breaks the built-in registry', () => {
  withConfig('{ this is not json', (registry) => {
    assert.ok(registry.getToolByKey('claude-code'));
    assert.ok(registry.getAllTools().length > 10);
  });
});

test('malicious command definitions are dropped, valid siblings survive', () => {
  withConfig({
    version: 1,
    tools: [
      { key: 'evil', command: 'claude; rm -rf ~' },
      { key: 'good-agent', command: 'node' }
    ]
  }, (registry) => {
    assert.equal(registry.getToolByKey('evil'), null);
    assert.ok(registry.getToolByKey('good-agent'));
  });
});

test('hidden tools are excluded from listings and auto-detection', () => {
  withConfig({ version: 1 }, (registry) => {
    assert.equal(registry.getToolByKey('demo').hidden, true);
    assert.ok(!registry.getVisibleTools().some(t => t.key === 'demo'));
    assert.ok(registry.getAllTools().some(t => t.key === 'demo'));
  });
});

test('tui is a per-tool field, not a hardcoded list', () => {
  withConfig({ version: 1, tools: [{ key: 'my-tui', command: 'node', tui: true }] }, (registry) => {
    assert.equal(registry.getToolByKey('opencode').tui, true);
    assert.equal(registry.getToolByKey('kilo').tui, true);
    assert.equal(registry.getToolByKey('aider').tui, false);
    assert.equal(registry.getToolByKey('my-tui').tui, true);
  });
});

test('protocolKey defaults to key and can be remapped', () => {
  withConfig({
    version: 1,
    tools: [{ key: 'claude-opus', command: 'claude', protocolKey: 'claude-code' }]
  }, (registry) => {
    assert.equal(registry.getToolByKey('aider').protocolKey, 'aider');
    assert.equal(registry.getToolByKey('claude-opus').protocolKey, 'claude-code');
  });
});
