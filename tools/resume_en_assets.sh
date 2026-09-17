#!/usr/bin/env bash
#
# resume_en_assets.sh - finish the `en` group download, fetching only what is missing.
#
# This is the same code path as the full download (`tools/assets_sync.py --groups all`),
# restricted to the `en` group and driven by the incremental state. There is no
# "download everything again" logic here: for every bundle in the manifest the script
# compares name and hash against what is already recorded in `.state/en.json`
# (assets_sync.py line 326, `state.is_done(name, hash)`) and processes only the ones
# that are missing. Running it twice in a row downloads nothing the second time.
#
# Usage:
#   bash tools/resume_en_assets.sh                 # resume where it stopped
#   DRY_RUN=1 bash tools/resume_en_assets.sh       # print the command only
#   LIMIT=50 bash tools/resume_en_assets.sh        # at most 50 bundles
#   REFRESH=1 bash tools/resume_en_assets.sh       # refresh the manifest first
#   CONCURRENCY=8 bash tools/resume_en_assets.sh   # more workers
#
# In the background:
#   nohup bash tools/resume_en_assets.sh >/dev/null 2>&1 &
#
# REFRESH: the cached manifest (`.state/hot_update_list_en.json`) is reused on purpose.
# Fetching the manifest from the server can bring a newer resVersion; the hashes change,
# the recorded progress stops matching, and the download restarts from zero. Use
# REFRESH=1 only when you actually want to move to the newest server snapshot.
#
# The payload lands in `assets/en/` and the log in `.state/run.log`. The payload, the
# log and `.state/` itself are all covered by the main repository's .gitignore.
#
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GROUP="${GROUP:-en}"
VENV="$ROOT/.venv-assets"
STATE_DIR="${STATE_ROOT:-$ROOT/.state}"
OUT_DIR="${OUT_ROOT:-$ROOT/assets}"
LOG="$STATE_DIR/run.log"
LOCK="$STATE_DIR/$GROUP.lock"
CONCURRENCY="${CONCURRENCY:-6}"

cd "$ROOT" || exit 1
mkdir -p "$STATE_DIR" "$OUT_DIR"

# Single-instance lock held in a pid file. Deliberately NOT pgrep -f: a pattern that
# matches the command line of the shell running it kills that shell, which already
# happened once in this repository.
if [ -f "$LOCK" ]; then
  old="$(cat "$LOCK" 2>/dev/null || true)"
  if [ -n "$old" ] && kill -0 "$old" 2>/dev/null; then
    echo "a download is already running (pid $old); nothing to do" >&2
    exit 1
  fi
  rm -f "$LOCK"
fi

if [ ! -x "$VENV/bin/python" ]; then
  echo "creating the environment in $VENV" >&2
  uv venv "$VENV" || exit 1
  "$VENV/bin/python" -m pip install --quiet "arkprts[all]" lameenc || exit 1
fi

ARGS=(--groups "$GROUP" --out "$OUT_DIR" --state "$STATE_DIR" --concurrency "$CONCURRENCY")
[ "${REFRESH:-0}" = "1" ] && ARGS+=(--refresh-manifest)
[ -n "${LIMIT:-}" ] && ARGS+=(--limit "$LIMIT")

CMD=("$VENV/bin/python" tools/assets_sync.py "${ARGS[@]}")

if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "cd $ROOT"
  printf '%q ' "${CMD[@]}"
  printf '\n'
  exit 0
fi

# Pre-flight: what is already done and what is left, read from the state and the manifest.
"$VENV/bin/python" - "$STATE_DIR" "$GROUP" <<'PY'
import json, pathlib, sys
state_dir, group = pathlib.Path(sys.argv[1]), sys.argv[2]
done_path = state_dir / f"{group}.json"
man_path = state_dir / f"hot_update_list_{group}.json"
done = json.loads(done_path.read_text()).get("done", {}) if done_path.exists() else {}
if man_path.exists():
    man = json.loads(man_path.read_text())
    audio = ("audio/", "voice", "sound_beta")
    entries = [i for i in man.get("abInfos", []) if not any(a in i["name"] for a in audio)]
    missing = [i for i in entries if done.get(i["name"]) != i.get("hash")]
    pct = 100 * (len(entries) - len(missing)) / len(entries) if entries else 0.0
    print(f"state: {len(done)} bundles done | manifest: {len(entries)} in the group "
          f"| missing {len(missing)} ({pct:.2f}% complete)")
    if missing:
        from collections import Counter
        c = Counter(i["name"].split("/")[0] for i in missing)
        print("missing by category: " + ", ".join(f"{k}={v}" for k, v in c.most_common(8)))
else:
    print(f"state: {len(done)} bundles done | no cached manifest "
          f"(it will be fetched from the server on this run)")
PY

echo "$$" > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

echo "group=$GROUP concurrency=$CONCURRENCY log=$LOG"
rc=0
"${CMD[@]}" >> "$LOG" 2>&1 || rc=$?
echo "finished with exit=$rc; last log lines:"
tail -3 "$LOG"
exit "$rc"
