import { vi } from "vitest";
import { mockRouter } from "@/test-utils/mock-router";

let mockPathname = "/";
let mockSearchParams = new URLSearchParams();

export function setMockPathname(pathname: string) {
  mockPathname = pathname;
}

export function setMockSearchParams(
  value: string | URLSearchParams | Record<string, string> = ""
) {
  if (value instanceof URLSearchParams) {
    mockSearchParams = new URLSearchParams(value);
    return;
  }
  if (typeof value === "string") {
    mockSearchParams = new URLSearchParams(value);
    return;
  }
  mockSearchParams = new URLSearchParams(value);
}

export function resetMockNavigation() {
  mockPathname = "/";
  mockSearchParams = new URLSearchParams();
}

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

