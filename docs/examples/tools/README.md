# Example: custom tmux-attach tool

A user-defined tool entry for `~/.termly/tools.json` that attaches an AI
session to an isolated tmux view holding a single linked window, picked at
invocation time.

## Files

- `tools.json` — the `tmux-window` entry to merge into your own
  `~/.termly/tools.json`.
- `tmux-attach-window.sh` — the script it invokes. Copy it to
  `~/.termly/scripts/tmux-attach-window.sh` and keep it executable.

## Usage

```bash
termly start --ai tmux-window --ai-args "main dboard"
```

`main` is the source tmux session, `dboard` the window to isolate. The
script resolves the window by name, links it into a dedicated solo session,
and attaches — detaching destroys that solo session, leaving the source
session untouched.
