/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import {
  CONTRACT_TABLE_SELECTION_KEY_PREFIX,
  RECENT_COMMANDS_KEY,
  RECENT_ITEMS_KEY_PREFIX,
  TABLE_DENSITY_KEY_PREFIX,
  UPLOAD_DRAFT_KEY_PREFIX,
  clearStoredRecentItems,
  readCommandPaletteRecentCommands,
  readContractTableSelection,
  readRecentItems,
  readTableDensityPreference,
  readUploadMetadataDraft,
  writeCommandPaletteRecentCommands,
  writeContractTableSelection,
  writeRecentItems,
  writeTableDensityPreference,
  writeUploadMetadataDraft,
} from "./client-storage";

describe("client-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("filters command palette recents to bounded same-origin paths", () => {
    window.localStorage.setItem(
      RECENT_COMMANDS_KEY,
      JSON.stringify(["/contracts", "https://evil.test", "//evil.test", "/assurance"])
    );

    expect(readCommandPaletteRecentCommands()).toEqual(["/contracts", "/assurance"]);

    writeCommandPaletteRecentCommands(["/contracts", "javascript:alert(1)", "/more"]);
    expect(JSON.parse(window.localStorage.getItem(RECENT_COMMANDS_KEY) ?? "[]")).toEqual([
      "/contracts",
      "/more",
    ]);
  });

  it("removes oversized, unsafe, or prototype-polluted JSON before hydration", () => {
    window.localStorage.setItem(
      RECENT_COMMANDS_KEY,
      '{"safe":{"__proto__":{"polluted":true}}}'
    );
    expect(readCommandPaletteRecentCommands()).toEqual([]);
    expect(window.localStorage.getItem(RECENT_COMMANDS_KEY)).toBeNull();

    window.sessionStorage.setItem(
      `${UPLOAD_DRAFT_KEY_PREFIX}org-1`,
      JSON.stringify({ title: "x".repeat(5000) })
    );
    expect(readUploadMetadataDraft("org-1")).toBeNull();
    expect(window.sessionStorage.getItem(`${UPLOAD_DRAFT_KEY_PREFIX}org-1`)).toBeNull();
  });

  it("keeps upload drafts bounded and strips unsafe fields", () => {
    writeUploadMetadataDraft("org-1", {
      title: "NDA",
      counterparty: "Acme",
      ownerLabel: "Casey Ops",
      contractType: "MSA",
      region: "NA",
      annualValue: "\u202ecad",
      tags: "vendor",
      sourceSystem: "CLM",
      externalReferenceId: "EXT-1",
    });

    expect(readUploadMetadataDraft("org-1")).toMatchObject({
      title: "NDA",
      counterparty: "Acme",
      annualValue: "",
    });
  });

  it("scopes contract table selection to safe sessionStorage keys", () => {
    writeContractTableSelection("org-1", ["contract-1", "contract-2", "bad\u0000id"]);

    expect(readContractTableSelection("org-1")).toEqual(["contract-1", "contract-2"]);
    expect(window.sessionStorage.getItem(`${CONTRACT_TABLE_SELECTION_KEY_PREFIX}org-1`)).toContain(
      "contract-1"
    );

    writeContractTableSelection("../org", ["contract-3"]);
    expect(window.sessionStorage.getItem(`${CONTRACT_TABLE_SELECTION_KEY_PREFIX}../org`)).toBeNull();
  });

  it("stores only approved table density preferences", () => {
    writeTableDensityPreference("contracts", "compact");

    expect(readTableDensityPreference("contracts")).toBe("compact");
    expect(window.localStorage.getItem(`${TABLE_DENSITY_KEY_PREFIX}contracts`)).toBe("compact");

    window.localStorage.setItem(`${TABLE_DENSITY_KEY_PREFIX}contracts`, "expanded");
    expect(readTableDensityPreference("contracts")).toBeNull();
    expect(window.localStorage.getItem(`${TABLE_DENSITY_KEY_PREFIX}contracts`)).toBeNull();

    writeTableDensityPreference("../contracts", "comfortable");
    expect(window.localStorage.getItem(`${TABLE_DENSITY_KEY_PREFIX}../contracts`)).toBeNull();
  });

  it("keeps recent items safe, bounded, and scope-limited", () => {
    writeRecentItems(
      "contract",
      [
        { id: "1", label: "MSA", href: "/contracts/1", visitedAt: 1 },
        { id: "2", label: "bad", href: "https://evil.test", visitedAt: 2 },
        { id: "3", label: "NDA", href: "/contracts/3", visitedAt: Number.POSITIVE_INFINITY },
      ],
      5
    );

    expect(readRecentItems("contract")).toEqual([
      { id: "1", label: "MSA", href: "/contracts/1", visitedAt: 1 },
    ]);
    expect(window.localStorage.getItem(`${RECENT_ITEMS_KEY_PREFIX}contract`)).toContain(
      "/contracts/1"
    );

    clearStoredRecentItems("contract");
    expect(window.localStorage.getItem(`${RECENT_ITEMS_KEY_PREFIX}contract`)).toBeNull();

    writeRecentItems("../contract", [{ id: "4", label: "bad", href: "/contracts/4", visitedAt: 4 }]);
    expect(window.localStorage.getItem(`${RECENT_ITEMS_KEY_PREFIX}../contract`)).toBeNull();
  });
});
