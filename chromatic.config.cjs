/**
 * Tier 67 — optional Chromatic / Percy (token via env; never block PR by default).
 */
module.exports = {
  projectId: process.env.CHROMATIC_PROJECT_ID || "",
  buildScriptName: "build",
  exitOnceUploaded: true,
  onlyChanged: true,
};
