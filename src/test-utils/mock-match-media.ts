type Listener = (event: MediaQueryListEvent) => void;

const queryMatches = new Map<string, boolean>();

export function setMatchMediaQuery(query: string, matches: boolean) {
  queryMatches.set(query, matches);
}

export function resetMockMatchMedia() {
  queryMatches.clear();
}

export function installMockMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => {
      const listeners = new Set<Listener>();
      const addWrappedListener = (listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === "function") {
          listeners.add(listener as Listener);
          return;
        }
        listeners.add(((event: MediaQueryListEvent) => listener.handleEvent(event)) as Listener);
      };
      const removeWrappedListener = (listener: EventListenerOrEventListenerObject) => {
        if (typeof listener === "function") {
          listeners.delete(listener as Listener);
        }
      };
      return {
        matches: queryMatches.get(query) ?? false,
        media: query,
        onchange: null,
        addListener: (listener: Listener) => {
          listeners.add(listener);
        },
        removeListener: (listener: Listener) => {
          listeners.delete(listener);
        },
        addEventListener: (_event: string, listener: EventListenerOrEventListenerObject) => {
          addWrappedListener(listener);
        },
        removeEventListener: (_event: string, listener: EventListenerOrEventListenerObject) => {
          removeWrappedListener(listener);
        },
        dispatchEvent: (event: Event) => {
          for (const listener of listeners) {
            listener(event as MediaQueryListEvent);
          }
          return true;
        },
      };
    },
  });
}

