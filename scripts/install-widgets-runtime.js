const { spawnSync } = require("node:child_process");

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const args = ["install", "--no-save", "--package-lock=false", "electron@^41.5.0"];

const env = {
  ...process.env,
  npm_config_registry: process.env.npm_config_registry || "https://registry.npmmirror.com",
  ELECTRON_MIRROR: process.env.ELECTRON_MIRROR || "https://npmmirror.com/mirrors/electron/",
  npm_config_electron_mirror:
    process.env.npm_config_electron_mirror || "https://npmmirror.com/mirrors/electron/",
};

console.log("Installing TokenUsage desktop widget runtime...");
console.log(`npm registry: ${env.npm_config_registry}`);
console.log(`Electron mirror: ${env.ELECTRON_MIRROR}`);
console.log("");

const result = spawnSync(npmCmd, args, {
  env,
  stdio: "inherit",
  shell: false,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status || 0);
