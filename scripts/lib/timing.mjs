#!/usr/bin/env node

export function nowMs() {
  return Date.now();
}

export function elapsedMs(startMs) {
  return Math.max(0, Date.now() - startMs);
}
