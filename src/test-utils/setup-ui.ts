import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, vi } from "vitest";
import "@/test-utils/mock-navigation";
import { resetMockNavigation } from "@/test-utils/mock-navigation";
import { resetMockRouter } from "@/test-utils/mock-router";
import {
  installMockIntersectionObserver,
  resetMockIntersectionObserver,
} from "@/test-utils/mock-intersection-observer";
import { installMockMatchMedia, resetMockMatchMedia } from "@/test-utils/mock-match-media";
import { installMockResizeObserver, resetMockResizeObserver } from "@/test-utils/mock-resize-observer";

beforeAll(() => {
  installMockMatchMedia();
  installMockResizeObserver();
  installMockIntersectionObserver();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
  Object.defineProperty(window, "requestAnimationFrame", {
    configurable: true,
    writable: true,
    value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0),
  });
});

beforeEach(() => {
  resetMockNavigation();
  resetMockRouter();
  resetMockMatchMedia();
  resetMockResizeObserver();
  resetMockIntersectionObserver();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

