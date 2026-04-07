#!/usr/bin/env python3
"""
view-logs.sh — human-readable viewer for openclaw-logger JSONL files
Usage:
  ./view-logs.sh                  # today's log
  ./view-logs.sh 2026-04-06       # specific date
  ./view-logs.sh --tail 20        # last N entries
  ./view-logs.sh --follow         # live tail (like tail -f)
  ./view-logs.sh --errors         # only show error/incomplete entries
  ./view-logs.sh --date 2026-04-06 --tail 5
"""

import sys
import os
import json
import argparse
import textwrap
import time
from datetime import datetime, timezone

# ── Config ────────────────────────────────────────────────────────────────────
LOG_DIR = os.path.expanduser("~/.openclaw/logs/conversations")
TERM_WIDTH = min(os.get_terminal_size().columns if sys.stdout.isatty() else 100, 120)
WRAP_WIDTH = TERM_WIDTH - 12  # indent for wrapped text

# ── ANSI colors (disabled if not a tty) ──────────────────────────────────────
USE_COLOR = sys.stdout.isatty()
def c(code, text): return f"\033[{code}m{text}\033[0m" if USE_COLOR else text
DIM    = lambda t: c("2", t)
BOLD   = lambda t: c("1", t)
CYAN   = lambda t: c("96", t)
GREEN  = lambda t: c("92", t)
YELLOW = lambda t: c("93", t)
RED    = lambda t: c("91", t)
GRAY   = lambda t: c("90", t)

# ── Helpers ───────────────────────────────────────────────────────────────────
def wrap(text, prefix="            "):
    """Word-wrap text to terminal width with a hanging indent."""
    if not text:
        return GRAY("(none)")
    lines = text.replace("\\n", "\n").splitlines()
    out = []
    for line in lines:
        if len(line) <= WRAP_WIDTH:
            out.append(line)
        else:
            out.extend(textwrap.wrap(line, width=WRAP_WIDTH))
    return ("\n" + prefix).join(out)

def fmt_ts(ts):
    """ISO timestamp → local readable."""
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        local = dt.astimezone()
        return local.strftime("%Y-%m-%d  %H:%M:%S %Z")
    except Exception:
        return ts

def fmt_tokens(entry):
    inp = entry.get("input_tokens")
    out = entry.get("output_tokens")
    tot = entry.get("total_tokens")
    if inp is None and out is None:
        return GRAY("no token data")
    parts = []
    if inp is not None:
        parts.append(f"{inp:,} in")
    if out is not None:
        parts.append(f"{out:,} out")
    if tot is not None:
        parts.append(GRAY(f"({tot:,} total)"))
    return "  ".join(parts)

def fmt_latency(ms):
    if ms is None:
        return GRAY("—")
    if ms < 1000:
        return f"{ms}ms"
    return f"{ms/1000:.1f}s"

def fmt_status(entry):
    status = entry.get("status", "?")
    err    = entry.get("error")
    if status == "ok" and not err:
        return GREEN("ok")
    if err:
        return RED(f"error: {err}")
    return YELLOW(status)

def divider(char="─"):
    return GRAY(char * TERM_WIDTH)

def render(entry, index=None):
    ts       = fmt_ts(entry.get("timestamp", ""))
    agent    = entry.get("agent_id") or "?"
    model    = entry.get("model") or "?"
    provider = entry.get("provider") or ""
    channel  = entry.get("channel") or "?"
    latency  = fmt_latency(entry.get("latency_ms"))
    tokens   = fmt_tokens(entry)
    status   = fmt_status(entry)
    thinking = entry.get("thinking_enabled", False)

    # Header bar
    idx_str = f"[{index}] " if index is not None else ""
    header = f"{BOLD(CYAN(ts))}  {GRAY('·')}  {BOLD(agent)}  {GRAY('·')}  {model}"
    if provider:
        header += GRAY(f"  ({provider})")
    print(divider())
    print(f"{idx_str}{header}")
    print(GRAY(f"  channel: {channel}   latency: {latency}   status: {status}   thinking: {'on' if thinking else 'off'}"))
    print(GRAY(f"  tokens:  {tokens}"))

    # User message
    user_msg = entry.get("user_message")
    print()
    print(BOLD("  USER"))
    if user_msg:
        print(f"  {YELLOW('>')} {wrap(user_msg, '            ')}")
    else:
        print(f"  {GRAY('(cli trigger / no inbound message captured)')}")

    # Response
    response = entry.get("response_text")
    print()
    print(BOLD("  RESPONSE"))
    if response:
        print(f"  {GREEN('>')} {wrap(response, '            ')}")
    else:
        print(f"  {GRAY('(no response text — tool-only run or incomplete entry)')}")

    # Thinking (only if present)
    thinking_text = entry.get("thinking_content")
    if thinking_text:
        print()
        print(BOLD("  THINKING"))
        print(f"  {GRAY('>')} {GRAY(wrap(thinking_text, '            '))}")

    # System prompt preview (collapsed by default, shown at bottom)
    sys_preview = entry.get("system_prompt_preview")
    char_count  = entry.get("full_prompt_char_count")
    if sys_preview or char_count:
        print()
        print(GRAY(f"  SYSTEM PROMPT PREVIEW  ({char_count:,} chars total)" if char_count else "  SYSTEM PROMPT PREVIEW"))
        if sys_preview:
            preview_short = sys_preview[:300].replace("\n", " ↵ ")
            print(f"  {GRAY(preview_short)}{GRAY('…') if len(sys_preview) > 300 else ''}")

    print()

def load_entries(log_file, errors_only=False):
    entries = []
    try:
        with open(log_file) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    if errors_only and entry.get("status") == "ok" and not entry.get("error"):
                        continue
                    entries.append(entry)
                except json.JSONDecodeError:
                    pass
    except FileNotFoundError:
        print(RED(f"No log file found: {log_file}"))
        sys.exit(1)
    return entries

# ── CLI ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="View openclaw-logger JSONL files")
    parser.add_argument("date",      nargs="?", help="Date in YYYY-MM-DD (default: today)")
    parser.add_argument("--date",    dest="date_flag", metavar="DATE", help="Date in YYYY-MM-DD")
    parser.add_argument("--tail",    type=int, metavar="N", help="Show last N entries")
    parser.add_argument("--follow",  action="store_true", help="Follow log file live")
    parser.add_argument("--errors",  action="store_true", help="Show only error/incomplete entries")
    args = parser.parse_args()

    date_str = args.date_flag or args.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    log_file = os.path.join(LOG_DIR, f"openclaw-{date_str}.jsonl")

    print(BOLD(f"\nopenclaw-logger  ·  {date_str}  ·  {log_file}"))
    print(GRAY(f"{'errors only' if args.errors else 'all entries'}"
               + (f"  ·  last {args.tail}" if args.tail else "")
               + ("  ·  following" if args.follow else "")))

    if args.follow:
        # Live tail
        entries_seen = 0
        with open(log_file) as f:
            # Fast-forward to end
            f.seek(0, 2)
            print(GRAY("\nWaiting for new entries (Ctrl+C to stop)...\n"))
            try:
                while True:
                    line = f.readline()
                    if not line:
                        time.sleep(0.5)
                        continue
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                        if args.errors and entry.get("status") == "ok" and not entry.get("error"):
                            continue
                        entries_seen += 1
                        render(entry, index=entries_seen)
                    except json.JSONDecodeError:
                        pass
            except KeyboardInterrupt:
                print(GRAY("\nStopped."))
        return

    entries = load_entries(log_file, errors_only=args.errors)

    if not entries:
        print(YELLOW("\n  No entries found.\n"))
        return

    if args.tail:
        entries = entries[-args.tail:]

    for i, entry in enumerate(entries, 1):
        render(entry, index=i)

    print(divider("═"))
    print(BOLD(f"  {len(entries)} entries") + GRAY(f"  ·  {date_str}"))
    total_in  = sum(e.get("input_tokens") or 0 for e in entries)
    total_out = sum(e.get("output_tokens") or 0 for e in entries)
    if total_in or total_out:
        print(GRAY(f"  Total tokens:  {total_in:,} in  ·  {total_out:,} out  ·  {total_in+total_out:,} combined"))
    print()

if __name__ == "__main__":
    main()
