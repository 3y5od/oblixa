/**
 * Edge proxy sets this header from `request.nextUrl.pathname` only (never from client input).
 * `(dashboard)/layout.tsx` reads it for V8 page eligibility.
 */
export const OBLIXA_PATHNAME_HEADER = "x-oblixa-pathname";
