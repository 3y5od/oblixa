export function isProductionLikeInboundEnvironment(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV === "production" || env.VERCEL === "1" || env.VERCEL_ENV === "production";
}
