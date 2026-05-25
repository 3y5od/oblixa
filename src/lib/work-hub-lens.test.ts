import { describe, expect, it } from "vitest";
import { normalizeWorkTab, WORK_TAB_ORDER } from "./work/model";

describe("Work tab aliases", () => {
  it("maps legacy lens query with safe default", () => {
    expect(normalizeWorkTab({ lens: undefined })).toBe("all");
    expect(normalizeWorkTab({ lens: "" })).toBe("all");
    expect(normalizeWorkTab({ lens: "assigned" })).toBe("my_work");
    expect(normalizeWorkTab({ lens: "overdue" })).toBe("overdue");
    expect(normalizeWorkTab({ lens: "not-a-lens" })).toBe("all");
  });

  it("enumerates the release-state Work tabs", () => {
    expect(WORK_TAB_ORDER).toEqual([
      "all",
      "my_work",
      "overdue",
      "blocked",
      "approvals",
      "obligations",
      "exceptions",
    ]);
  });
});
