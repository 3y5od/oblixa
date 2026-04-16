type ResizeObserverCallbackRecord = {
  callback: ResizeObserverCallback;
};

const records: ResizeObserverCallbackRecord[] = [];

export function installMockResizeObserver() {
  class MockResizeObserver implements ResizeObserver {
    callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
      records.push({ callback });
    }

    observe() {}

    unobserve() {}

    disconnect() {}
  }

  Object.defineProperty(window, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: MockResizeObserver,
  });
}

export function resetMockResizeObserver() {
  records.length = 0;
}

