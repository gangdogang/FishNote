#!/usr/bin/env bash

set -uo pipefail

usage() {
  echo "usage: $0 <seconds> -- <command> [args...]" >&2
}

collect_process_tree() {
  local parent_pid="$1"
  local child_pid

  if command -v pgrep >/dev/null 2>&1; then
    for child_pid in $(pgrep -P "$parent_pid" 2>/dev/null || true); do
      collect_process_tree "$child_pid"
    done
  fi

  printf '%s\n' "$parent_pid"
}

signal_process_tree() {
  local signal_name="$1"
  local process_tree="$2"
  local process_pid

  while IFS= read -r process_pid; do
    if [[ -n "$process_pid" ]]; then
      kill "-${signal_name}" "$process_pid" 2>/dev/null || true
    fi
  done <<< "$process_tree"
}

if [[ $# -lt 3 || ! "$1" =~ ^[1-9][0-9]*$ || "$2" != "--" ]]; then
  usage
  exit 2
fi

timeout_seconds="$1"
shift 2

uses_process_group=false
if command -v setsid >/dev/null 2>&1; then
  setsid "$@" &
  command_pid=$!
  uses_process_group=true
else
  "$@" &
  command_pid=$!
fi

started_at=$(date +%s)

while kill -0 "$command_pid" 2>/dev/null; do
  current_time=$(date +%s)
  elapsed_seconds=$((current_time - started_at))

  if (( elapsed_seconds >= timeout_seconds )); then
    echo "[timeout] command exceeded ${timeout_seconds}s: $*" >&2
    date >&2
    pwd >&2
    ps -eo pid,ppid,pgid,etime,stat,%cpu,%mem,args --forest >&2 \
      || ps -ax -o pid,ppid,pgid,etime,state,%cpu,%mem,command >&2 \
      || true
    if command -v pstree >/dev/null 2>&1; then
      pstree -ap "$command_pid" >&2 || true
    fi

    process_tree=$(collect_process_tree "$command_pid")
    if [[ "$uses_process_group" == true ]]; then
      kill -TERM -- "-${command_pid}" 2>/dev/null || true
    else
      signal_process_tree TERM "$process_tree"
    fi

    termination_started_at=$(date +%s)
    while kill -0 "$command_pid" 2>/dev/null; do
      current_time=$(date +%s)
      if (( current_time - termination_started_at >= 10 )); then
        if [[ "$uses_process_group" == true ]]; then
          kill -KILL -- "-${command_pid}" 2>/dev/null || true
        else
          signal_process_tree KILL "$process_tree"
        fi
        break
      fi
      sleep 1
    done

    wait "$command_pid" 2>/dev/null || true
    exit 124
  fi

  sleep 1
done

wait "$command_pid"
exit $?
