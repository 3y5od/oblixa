import { Source_Serif_4 } from "next/font/google";

/** Display serif for the warm editorial marketing system (lp-*).
 *
 *  Loaded here — not in the root layout — so product-app routes never pay for
 *  a typeface they don't render. The variable is applied by `src/app/page.tsx`
 *  on a `display: contents` wrapper around <LandingPage />, which keeps
 *  `next/font` out of the component tree that vitest renders (jsdom falls back
 *  to the Georgia stack declared in `.lp-serif`).
 *
 *  Source Serif 4 carries the legal-editorial heading voice: high-contrast at
 *  display sizes via the `opsz` axis, sturdy at small sizes, no costume. */
export const lpSerif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif-display",
  axes: ["opsz"],
});
