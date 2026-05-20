const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

function resolveTrackerRootDir(home = os.homedir()) {
  return path.join(home, ".tokenusage");
}

function resolveLegacyTrackerRootDir(home = os.homedir()) {
  return path.join(home, ".tokentracker");
}

async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function isSymlink(targetPath) {
  try {
    const stat = await fsp.lstat(targetPath);
    return stat.isSymbolicLink();
  } catch {
    return false;
  }
}

async function createLegacyCompatibilityLink({ home = os.homedir() } = {}) {
  const legacyRoot = resolveLegacyTrackerRootDir(home);
  const rootDir = resolveTrackerRootDir(home);
  if (await pathExists(legacyRoot)) return;
  try {
    await fsp.symlink(rootDir, legacyRoot, "junction");
  } catch {
    // Best-effort only; the new root remains canonical.
  }
}

async function removeLegacyCompatibilityLink({ home = os.homedir() } = {}) {
  const legacyRoot = resolveLegacyTrackerRootDir(home);
  if (!(await pathExists(legacyRoot))) return;
  if (!(await isSymlink(legacyRoot))) return;
  await fsp.rm(legacyRoot, { recursive: true, force: true }).catch(() => {});
}

async function mergeLegacyIntoCurrent({ legacyRoot, rootDir }) {
  await fsp.mkdir(rootDir, { recursive: true });

  const entries = await fsp.readdir(legacyRoot, { withFileTypes: true });
  for (const entry of entries) {
    const fromPath = path.join(legacyRoot, entry.name);
    const toPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      if (await pathExists(toPath)) {
        await mergeLegacyIntoCurrent({ legacyRoot: fromPath, rootDir: toPath });
      } else {
        await fsp.cp(fromPath, toPath, {
          recursive: true,
          force: false,
          preserveTimestamps: true,
        });
      }
      continue;
    }

    if (entry.isFile()) {
      if (await pathExists(toPath)) continue;
      await fsp.copyFile(fromPath, toPath);
      continue;
    }

    if (entry.isSymbolicLink()) {
      if (await pathExists(toPath)) continue;
      try {
        const target = await fsp.readlink(fromPath);
        await fsp.symlink(target, toPath, "junction");
      } catch {
        // Ignore legacy links we cannot recreate.
      }
    }
  }
}

async function migrateTrackerRoot({ home = os.homedir() } = {}) {
  const rootDir = resolveTrackerRootDir(home);
  const legacyRoot = resolveLegacyTrackerRootDir(home);

  const hasNew = await pathExists(rootDir);
  const hasOld = await pathExists(legacyRoot);

  if (hasNew) {
    if (hasOld) {
      if (await isSymlink(legacyRoot)) {
        await removeLegacyCompatibilityLink({ home });
      } else {
        await mergeLegacyIntoCurrent({ legacyRoot, rootDir });
        await fsp.rm(legacyRoot, { recursive: true, force: true });
      }
    }
    return rootDir;
  }

  if (!hasOld) {
    await fsp.mkdir(rootDir, { recursive: true });
    return rootDir;
  }

  const oldIsLink = await isSymlink(legacyRoot);
  if (oldIsLink) {
    try {
      const real = await fsp.realpath(legacyRoot);
      await fsp.mkdir(real, { recursive: true });
      return real;
    } catch {
      await fsp.mkdir(rootDir, { recursive: true });
      return rootDir;
    }
  }

  try {
    await fsp.rename(legacyRoot, rootDir);
  } catch {
    await fsp.cp(legacyRoot, rootDir, {
      recursive: true,
      force: true,
      preserveTimestamps: true,
    });
    await fsp.rm(legacyRoot, { recursive: true, force: true });
  }

  return rootDir;
}

async function resolveTrackerPaths({ home = os.homedir() } = {}) {
  const rootDir = await migrateTrackerRoot({ home });
  return {
    rootDir,
    trackerDir: path.join(rootDir, "tracker"),
    binDir: path.join(rootDir, "bin"),
    cacheDir: path.join(rootDir, "cache"),
  };
}

module.exports = {
  migrateTrackerRoot,
  resolveLegacyTrackerRootDir,
  resolveTrackerPaths,
  resolveTrackerRootDir,
};
