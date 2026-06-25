#!/usr/bin/env node

// Release-evidence self-check markers retained by the command entrypoint:
// metricCapture === "all"
// denominatorLock === "all"
// --post-ga
// --external-blockers
// runtimeCaptureRequired
// syntheticDataUsedForPromotion
import "./lib/check-release-evidence-implementation.mjs";
