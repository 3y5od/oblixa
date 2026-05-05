export function defaultExpectedOutcomesForRunnerHint(runnerHint, methods = ["GET"]) {
  if (runnerHint === "session_or_worker_unsigned_reject" || runnerHint === "signature_or_unsigned_reject") {
    return ["401_auth", "403_auth", "503_dependency_blocked"];
  }
  if (runnerHint === "public_or_token_surface") {
    if (methods.includes("GET")) {
      return ["200_success", "302_redirect", "404_not_found", "429_rate_limited", "503_dependency_blocked"];
    }
    return ["200_success", "400_validation", "404_not_found", "429_rate_limited", "503_dependency_blocked"];
  }
  if (runnerHint === "defer_cron_canary") {
    return ["200_success", "207_partial", "401_auth", "429_rate_limited", "503_dependency_blocked"];
  }
  return ["200_success", "500_unhandled_internal"];
}

export function verificationHintForRunnerHint(runnerHint) {
  if (runnerHint === "public_or_token_surface") return "public_or_token_semantic";
  if (runnerHint === "defer_cron_canary") return "cron_semantic_deferred";
  if (runnerHint === "signature_or_unsigned_reject") return "unsigned_signature_reject";
  return "unsigned_auth_reject";
}

function hasDependencyBlockedSignal(status, bodyText, headers) {
  if (status !== 503) return false;
  const text = String(bodyText ?? "").toLowerCase();
  if (text.includes("dependency_blocked") || text.includes("not configured") || text.includes("canonical app url")) {
    return true;
  }
  const contentType = headers?.get?.("content-type") ?? "";
  if (!String(contentType).includes("application/json")) return false;
  try {
    const body = JSON.parse(bodyText || "{}");
    return body?.code === "dependency_blocked" || body?.error === "dependency_blocked" || body?.outcome === "dependency_blocked";
  } catch {
    return false;
  }
}

export function classifyRuntimeSmokeResponse(row, response, bodyText) {
  const expected = new Set(row.expectedOutcomes ?? defaultExpectedOutcomesForRunnerHint(row.runnerHint, row.methods ?? []));
  const status = response.status;

  if (status >= 200 && status < 300 && expected.has("200_success")) {
    return { passed: true, outcomeClass: "healthy", detail: `accepted ${status}` };
  }
  if (status >= 300 && status < 400 && expected.has("302_redirect")) {
    return { passed: true, outcomeClass: "redirect", detail: `accepted redirect ${status}` };
  }
  if (status === 400 && expected.has("400_validation")) {
    return { passed: true, outcomeClass: "validation", detail: "accepted 400 validation outcome" };
  }
  if (status === 401 && expected.has("401_auth")) {
    return { passed: true, outcomeClass: "auth_rejected", detail: "accepted 401 auth outcome" };
  }
  if (status === 403 && expected.has("403_auth")) {
    return { passed: true, outcomeClass: "auth_rejected", detail: "accepted 403 auth outcome" };
  }
  if (status === 404 && expected.has("404_not_found")) {
    return { passed: true, outcomeClass: "not_found", detail: "accepted 404 token/public miss" };
  }
  if (status === 429 && expected.has("429_rate_limited")) {
    return { passed: true, outcomeClass: "rate_limited", detail: "accepted 429 rate limit outcome" };
  }
  if (expected.has("503_dependency_blocked") && hasDependencyBlockedSignal(status, bodyText, response.headers)) {
    return { passed: true, outcomeClass: "dependency_blocked", detail: "accepted 503 dependency-blocked outcome" };
  }
  if (row.runnerHint === "public_or_token_surface" && status < 500) {
    return { passed: true, outcomeClass: "safe_public_surface", detail: `accepted safe public/token status ${status}` };
  }

  return {
    passed: false,
    outcomeClass: "unexpected",
    detail: `unexpected status ${status}; expected one of ${[...expected].join(", ") || "(none specified)"}`,
  };
}

function requireNonNegativeNumber(body, key, failures) {
  if (typeof body?.[key] !== "number" || Number.isNaN(body[key]) || body[key] < 0) {
    failures.push(`${key}:expected_non_negative_number`);
  }
}

export function assertCronSemanticContract(route, body) {
  const failures = [];
  switch (route) {
    case "/api/reminders/send": {
      for (const key of ["sent", "candidates", "skipped_no_email", "skipped", "failed"]) requireNonNegativeNumber(body, key, failures);
      if (typeof body.sent === "number" && typeof body.candidates === "number" && body.sent > body.candidates) {
        failures.push("sent:exceeds_candidates");
      }
      break;
    }
    case "/api/notifications/retry-deliveries": {
      for (const key of ["scanned", "delivered", "failed", "retried", "skipped"]) requireNonNegativeNumber(body, key, failures);
      if (
        [body.scanned, body.delivered, body.failed, body.retried, body.skipped].every((value) => typeof value === "number") &&
        body.scanned !== body.delivered + body.failed + body.retried + body.skipped
      ) {
        failures.push("scanned:bucket_total_mismatch");
      }
      break;
    }
    case "/api/webhooks/dispatch": {
      for (const key of ["candidates", "delivered", "attempts", "totalFailures"]) requireNonNegativeNumber(body, key, failures);
      if (typeof body.delivered === "number" && typeof body.candidates === "number" && body.delivered > body.candidates) {
        failures.push("delivered:exceeds_candidates");
      }
      if (typeof body.attempts === "number" && typeof body.delivered === "number" && body.attempts < body.delivered) {
        failures.push("attempts:below_delivered");
      }
      break;
    }
    case "/api/tasks/run-rules": {
      for (const key of ["organizations", "evaluatedRules", "generated"]) requireNonNegativeNumber(body, key, failures);
      break;
    }
    case "/api/cron/v4/evidence-followup": {
      for (const key of [
        "reviewed",
        "exceptionsCreated",
        "notificationsQueued",
        "escalationTasksCreated",
        "notificationDuplicatesSkipped",
        "escalationTaskDuplicatesSkipped",
      ]) {
        if (key in body) requireNonNegativeNumber(body, key, failures);
      }
      break;
    }
    case "/api/cron/v4/report-packs-generate": {
      for (const key of ["generated", "duplicateSkipped", "subscriptionEmailsSent"]) {
        if (key in body) requireNonNegativeNumber(body, key, failures);
      }
      break;
    }
    case "/api/cron/v6/review-board-packet-generation": {
      for (const key of ["generated", "boardsScanned", "notificationsAttempted", "notificationsDelivered", "duplicateRunsSkipped"]) {
        if (key in body) requireNonNegativeNumber(body, key, failures);
      }
      if (
        typeof body.notificationsAttempted === "number" &&
        typeof body.notificationsDelivered === "number" &&
        body.notificationsDelivered > body.notificationsAttempted
      ) {
        failures.push("notificationsDelivered:exceeds_notificationsAttempted");
      }
      break;
    }
    case "/api/cron/v6/health-graph-rollups": {
      for (const key of ["nodes", "edges"]) requireNonNegativeNumber(body, key, failures);
      break;
    }
    default:
      break;
  }
  return failures;
}