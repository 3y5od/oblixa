import { describe, it, expect } from "vitest";
import {
  EMAIL_TASK_BODY_MAX,
  EMAIL_TASK_EXTERNAL_MESSAGE_ID_RE,
  EMAIL_TASK_FROM_MAX,
  EMAIL_TASK_SUBJECT_MAX,
} from "./email-inbound-limits";

describe("email inbound payload boundaries (from-email route contract)", () => {
  it("rejects externalMessageId with newlines or spaces", () => {
    expect(EMAIL_TASK_EXTERNAL_MESSAGE_ID_RE.test("ok-id-1")).toBe(true);
    expect(EMAIL_TASK_EXTERNAL_MESSAGE_ID_RE.test("bad id")).toBe(false);
    expect(EMAIL_TASK_EXTERNAL_MESSAGE_ID_RE.test("a\nb")).toBe(false);
  });

  it("documents max field sizes", () => {
    expect(EMAIL_TASK_SUBJECT_MAX).toBe(240);
    expect(EMAIL_TASK_BODY_MAX).toBe(10_000);
    expect(EMAIL_TASK_FROM_MAX).toBe(320);
  });
});
