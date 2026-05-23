#!/usr/bin/env node
import process from "node:process";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import {
  isSourceFileName,
  isTestLikeFile,
  issueReport,
  lineForOffset,
  nodeNameText,
  parseSource,
  readText,
  stringLiteralValue,
  walkAst,
  walkFiles,
} from "./lib/static-check-utils.mjs";

const SENSITIVE_STREAM_TEXT_RE = /token|secret|password|authorization|cookie|set-cookie|api[_-]?key|private[_-]?url|raw[_-]?(?:text|document|payload)/i;
const REDACTION_GUARD_RE = /\b(?:redact|sanitize|scrub|safeError|safePayload|safeMetadata)\b/i;

function isStreamSurface(node) {
  if (ts.isNewExpression(node)) {
    const name = nodeNameText(node.expression);
    return name === "ReadableStream" || name === "TransformStream";
  }
  const literal = stringLiteralValue(node);
  return literal === "text/event-stream";
}

function isEnqueueCall(node) {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "enqueue"
  );
}

export function analyzeStreamPayloadSensitivity(root = process.cwd()) {
  const issues = [];
  const files = walkFiles(root, ["src"], {
    include(rel, name) {
      return isSourceFileName(name) && !isTestLikeFile(rel);
    },
  });

  for (const file of files) {
    const source = readText(root, file);
    const { ast } = parseSource(root, file);
    let streamSurfaceLine = null;
    const enqueueCalls = [];

    walkAst(ast, (node) => {
      if (streamSurfaceLine === null && isStreamSurface(node)) {
        streamSurfaceLine = lineForOffset(ast, node.getStart(ast));
      }
      if (isEnqueueCall(node)) enqueueCalls.push(node);
    });

    if (streamSurfaceLine === null && enqueueCalls.length === 0) continue;
    if (REDACTION_GUARD_RE.test(source)) continue;

    const unsafeEnqueue = enqueueCalls.find((node) => SENSITIVE_STREAM_TEXT_RE.test(node.getText(ast)));
    if (unsafeEnqueue) {
      issues.push({
        issue: "stream_enqueue_missing_redaction_guard",
        file,
        line: lineForOffset(ast, unsafeEnqueue.getStart(ast)),
      });
    } else if (SENSITIVE_STREAM_TEXT_RE.test(source)) {
      issues.push({
        issue: "stream_surface_missing_redaction_guard",
        file,
        line: streamSurfaceLine ?? lineForOffset(ast, enqueueCalls[0].getStart(ast)),
      });
    }
  }

  return issueReport("stream-payload-sensitivity", issues, { filesChecked: files.length });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = analyzeStreamPayloadSensitivity();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
