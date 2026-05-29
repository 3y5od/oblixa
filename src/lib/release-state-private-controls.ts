export function arePrivateProductControlsEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.OBLIXA_ENABLE_PRIVATE_PRODUCT_CONTROLS === "1";
}
