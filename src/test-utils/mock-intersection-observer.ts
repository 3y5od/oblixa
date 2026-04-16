type IntersectionObserverCallbackRecord = {
  callback: IntersectionObserverCallback;
};

const records: IntersectionObserverCallbackRecord[] = [];

export function installMockIntersectionObserver() {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "0px";
    readonly thresholds = [0];
    callback: IntersectionObserverCallback;

    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
      records.push({ callback });
    }

    observe() {}

    unobserve() {}

    disconnect() {}

    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: MockIntersectionObserver,
  });
}

export function resetMockIntersectionObserver() {
  records.length = 0;
}

