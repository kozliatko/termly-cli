# Custom AI Tools & Models

Termly ships with a built-in registry of AI CLIs. You can add your own — or
repoint an existing one — from a JSON file, without waiting for a Termly
release and without editing `node_modules`.

```bash
termly tools init       # create ~/.termly/tools.json with a worked example
termly tools validate   # check it (exit code 1 on errors)
termly tools config     # show what it currently defines
termly tools list       # see it merged with the built-ins
```

## File location

| Order | Location |
|-------|----------|
| 1 | `$TERMLY_TOOLS_FILE` (if set) |
| 2 | `~/.termly/tools.json` |

Only your home directory is read. **Project-local tool files are deliberately
not supported** — cloning a repository must never be able to make Termly spawn
a command chosen by someone else.

## Format

```json
{
  "version": 1,
  "tools": [
    {
      "key": "ollama-qwen",
      "command": "ollama",
      "args": ["run", "qwen2.5-coder:32b"],
      "displayName": "Ollama — Qwen2.5 Coder 32B",
      "description": "Local Qwen2.5-Coder model served by Ollama",
      "website": "https://ollama.ai",
      "install": "https://ollama.ai/download",
      "env": { "OLLAMA_HOST": "http://127.0.0.1:11434" },
      "protocolKey": "ollama"
    }
  ],
  "overrides": {
    "claude-code": { "command": "flaude" }
  }
}
```

`tools[]` adds a new entry (or fully replaces a built-in with the same `key`).
`overrides{}` patches individual fields of a built-in and leaves the rest alone.

## Fields

| Field | Required | Default | Purpose |
|-------|----------|---------|---------|
| `key` | ✅ | — | Identifier for `--ai <key>`. `^[a-z0-9][a-z0-9-]{1,31}$`, unique. |
| `command` | ✅ | — | Executable to spawn. Name on `PATH` or a path. No shell metacharacters. |
| `args` | | `[]` | Fixed arguments, prepended to `--ai-args`. |
| `displayName` | | `key` | Shown in listings and on mobile. |
| `description` | | `""` | Shown by `termly tools info`. |
| `website` | | `""` | Reference URL. |
| `install` | | `website` | Shown when the tool is missing. |
| `env` | | — | Extra environment for the spawned process — **this is how you pin a model**. |
| `tui` | | `false` | Alternate-screen app: skip the catchup buffer, clear screen on connect. |
| `hidden` | | `false` | Exclude from `tools list` and auto-detection; still reachable via `--ai`. |
| `checkCommand` | | `command` | Probe a different binary than the one you spawn. |
| `versionArgs` | | `--version`, then `-v` | Override version detection. |
| `protocolKey` | | `key` | Tool key reported to the server and mobile app (see below). |

## Selecting a model

Most AI CLIs pick their model from a flag or an environment variable, so a
"model" is just a tool definition:

```json
{
  "version": 1,
  "tools": [
    {
      "key": "claude-opus",
      "command": "claude",
      "args": ["--model", "opus"],
      "displayName": "Claude Code (Opus)",
      "protocolKey": "claude-code"
    },
    {
      "key": "aider-deepseek",
      "command": "aider",
      "args": ["--model", "deepseek/deepseek-coder"],
      "displayName": "Aider — DeepSeek",
      "env": { "DEEPSEEK_API_KEY": "sk-..." },
      "protocolKey": "aider"
    }
  ]
}
```

> `~/.termly/tools.json` is created with mode `600`. It is still a plaintext
> file — prefer referencing credentials that already live in your shell profile
> over pasting API keys here.

## `protocolKey` — staying compatible with the mobile app

Termly sends the tool key to the pairing API, and the mobile app uses it to
decide how to render the session (TUI vs. line-oriented). A key the app has
never heard of may render poorly.

Set `protocolKey` to the closest built-in key so a custom entry keeps working
end to end, while `key` and `displayName` stay whatever you want locally.

## Validation and failure behaviour

Loading is **fail-soft**: invalid entries are reported as warnings and skipped,
and the built-in registry always still loads. A broken `tools.json` can never
stop `termly start` from working.

Rejected outright:

- keys that are not lowercase-kebab, or duplicated
- commands containing `;`, `|`, `&`, `` ` ``, `$`, `<`, `>`, quotes or newlines
- unknown fields (so typos surface instead of being ignored)
- non-string `env` values or invalid environment variable names

Commands are spawned with `execFile` / `pty.spawn` and probed via `execFile` —
never through a shell string — so a definition cannot inject shell syntax.

## Example

See [`docs/examples/tools/`](examples/tools/) for a complete worked example —
a `tmux-window` entry that attaches an AI session to an isolated view of a
single linked tmux window, picked at invocation time via `--ai-args`.
