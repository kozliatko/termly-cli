#!/bin/bash
# Generic version of tmux-dboard-solo.sh: attaches to an isolated session
# holding only ONE linked window, picked at invocation time via two
# positional args (source session, source window) instead of being
# hardcoded to main/dboard. Meant to be driven by termly's --ai-args, e.g.:
#   termly start --ai tmux-window --ai-args "main dboard"
#   termly start --ai tmux-window --ai-args "main otrs-report"
set -euo pipefail
unset TMUX

SRC_SESSION="${1:-}"
SRC_WINDOW="${2:-}"

if [ -z "$SRC_SESSION" ] || [ -z "$SRC_WINDOW" ]; then
  echo "Usage: termly start --ai tmux-window --ai-args \"<session> <window>\"" >&2
  echo "Example: termly start --ai tmux-window --ai-args \"main dboard\"" >&2
  exit 1
fi

if ! tmux has-session -t "$SRC_SESSION" 2>/dev/null; then
  echo "No such tmux session: $SRC_SESSION" >&2
  exit 1
fi

# Resolve to a numeric window index rather than referencing the window by
# name in a session:window target - a name containing "." (e.g.
# "periody.cal") gets misparsed by tmux as a window.pane target and fails
# with "can't find pane", since "." is tmux's own window/pane separator.
SRC_INDEX="$(tmux list-windows -t "$SRC_SESSION" -F '#{window_index}	#{window_name}' | awk -F'\t' -v w="$SRC_WINDOW" '$2 == w {print $1; exit}')"

if [ -z "$SRC_INDEX" ]; then
  echo "No window named '$SRC_WINDOW' in session '$SRC_SESSION'" >&2
  echo "Windows in $SRC_SESSION:" >&2
  tmux list-windows -t "$SRC_SESSION" -F '  #{window_index}: #{window_name}' >&2
  exit 1
fi

# tmux session names can't safely contain ":" or "." (target-spec separators),
# so build a sanitized, collision-resistant isolated session name from the
# source session+window. Same source always maps to the same solo session,
# so re-running this against something already attached just adds a second
# client to the same view instead of creating a duplicate.
SANITIZE() { printf '%s' "$1" | tr -c 'A-Za-z0-9_-' '_'; }
SOLO="termly-solo-$(SANITIZE "$SRC_SESSION")-$(SANITIZE "$SRC_WINDOW")"

if ! tmux has-session -t "$SOLO" 2>/dev/null; then
  tmux new-session -d -s "$SOLO" -n placeholder
  tmux link-window -s "${SRC_SESSION}:${SRC_INDEX}" -t "${SOLO}:1"
  tmux kill-window -t "${SOLO}:placeholder"
fi

# destroy-unattached fires the instant it's set, not just on a future
# detach - must be chained AFTER attach-session, in the same invocation,
# so the session is already attached when the option takes effect.
exec tmux attach-session -t "$SOLO" \; set-option -t "$SOLO" destroy-unattached on
