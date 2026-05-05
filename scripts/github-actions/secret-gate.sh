#!/usr/bin/env bash

set -euo pipefail

label="${1:-secret-gated workflow}"
strict_var="${2:-}"
required_csv="${3:-}"

if [ -z "${GITHUB_OUTPUT:-}" ]; then
  echo "secret-gate.sh requires GITHUB_OUTPUT to be set" >&2
  exit 1
fi

IFS=',' read -r -a required <<< "$required_csv"
missing=()

for key in "${required[@]}"; do
  key="${key//[[:space:]]/}"
  [ -n "$key" ] || continue
  if [ -z "${!key:-}" ]; then
    missing+=("$key")
  fi
done

missing_csv=""
if [ ${#missing[@]} -gt 0 ]; then
  missing_csv=$(IFS=,; printf '%s' "${missing[*]}")
fi

printf 'missing=%s\n' "$missing_csv" >> "$GITHUB_OUTPUT"

if [ ${#missing[@]} -eq 0 ]; then
  printf 'run=true\nmode=ready\n' >> "$GITHUB_OUTPUT"
  exit 0
fi

printf 'run=false\n' >> "$GITHUB_OUTPUT"

if [ -n "$strict_var" ] && [ "${!strict_var:-}" = "true" ]; then
  printf 'mode=strict_failure\n' >> "$GITHUB_OUTPUT"
  echo "::error::${label} requires ${missing_csv}. Set the missing secrets or unset ${strict_var} to keep the default skip behavior."
  exit 1
fi

printf 'mode=skip\n' >> "$GITHUB_OUTPUT"
echo "::notice::${label} skipped because required secrets are missing (${missing_csv}). Set ${strict_var}=true to fail closed."