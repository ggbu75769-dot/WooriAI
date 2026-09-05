const fs = require("node:fs");
const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "..");
const adminRoot = path.join(workspaceRoot, "apps/admin");

function isWithin(root, file) {
  const relative = path.relative(root, file);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function standaloneSymlink(root, outputRoot, symlink = fs.promises.symlink.bind(fs.promises)) {
  return async (target, destination, type) => {
    const absoluteTarget = path.resolve(path.dirname(destination), target);
    if (!isWithin(outputRoot, destination) || !isWithin(root, absoluteTarget)) {
      return symlink(target, destination, type);
    }
    const stat = await fs.promises.stat(absoluteTarget).catch(() => null);
    if (!stat?.isDirectory()) return symlink(target, destination, type);

    // Next copies pnpm directory links without a type. Windows requires admin
    // privileges for those links, but supports directory junctions normally.
    // Point at the traced copy inside standalone, never the source node_modules.
    const tracedTarget = isWithin(outputRoot, absoluteTarget)
      ? absoluteTarget
      : path.join(outputRoot, path.relative(root, absoluteTarget));
    await fs.promises.mkdir(tracedTarget, { recursive: true });
    return symlink(tracedTarget, destination, "junction");
  };
}

if (require.main === module) {
  process.chdir(adminRoot);
  if (process.platform === "win32") {
    fs.promises.symlink = standaloneSymlink(workspaceRoot, path.join(adminRoot, ".next/standalone"));
  }
  const cli = require.resolve("next/dist/bin/next", { paths: [adminRoot] });
  process.argv = [process.execPath, cli, "build", ...process.argv.slice(2)];
  require(cli);
}

module.exports = { standaloneSymlink };
