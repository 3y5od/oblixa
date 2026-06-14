import { Source_Serif_4 } from "next/font/google";

/** Display serif for the editorial design system (lp-*). */
export const lpSerif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif-display",
  axes: ["opsz"],
});
