import { STUB_CLASS_COUNT, STUB_CLASS_REGISTRY } from "./catalog-stubs.generated";

let stubsRegistered = false;

/** Registers all generated sweep stubs once (idempotent). */
export function registerDebuggingSweepStubs(): number {
  if (stubsRegistered) return STUB_CLASS_COUNT;
  stubsRegistered = true;
  for (const fn of Object.values(STUB_CLASS_REGISTRY)) {
    fn();
  }
  return STUB_CLASS_COUNT;
}

export function getStubsRegisteredCount(): number {
  return stubsRegistered ? STUB_CLASS_COUNT : 0;
}

export { STUB_CLASS_COUNT };
