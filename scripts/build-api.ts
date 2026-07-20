import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";

async function main() {
  const root = resolve(__dirname, "..");
  const tscOut = resolve(root, ".build/api-tsc");
  const outputDir = resolve(root, "apps/api/dist");
  const typescriptCli = resolve(root, "node_modules/typescript/bin/tsc");

  rmSync(tscOut, { recursive: true, force: true });
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  if (!existsSync(typescriptCli)) throw new Error(`Local TypeScript CLI is missing: ${typescriptCli}`);
  execFileSync(process.execPath, [typescriptCli, "-p", "apps/api/tsconfig.build.json"], {
    cwd: root,
    stdio: "inherit"
  });

  const emittedEntries = {
    main: resolve(tscOut, "apps/api/src/main.js"),
    publisher: resolve(tscOut, "apps/api/src/publisher.js"),
    worker: resolve(tscOut, "apps/api/src/worker.js")
  };
  const emittedDomain = resolve(tscOut, "packages/domain/src/index.js");
  const emittedContracts = resolve(tscOut, "packages/contracts/src/index.js");

  for (const required of [...Object.values(emittedEntries), emittedDomain, emittedContracts]) {
    if (!existsSync(required)) {
      throw new Error(`API build emit is missing: ${required}`);
    }
  }

  for (const [name, entry] of Object.entries(emittedEntries)) {
    await build({
      entryPoints: [entry],
      outfile: resolve(outputDir, `${name}.cjs`),
      bundle: true,
      platform: "node",
      target: "node20",
      format: "cjs",
      external: [
        "@aws-sdk/client-s3",
        "@nestjs/common",
        "@nestjs/core",
        "@nestjs/platform-express",
        "@prisma/client",
        "bullmq",
        "class-transformer",
        "class-validator",
        "exceljs",
        "iconv-lite",
        "ioredis",
        "jose",
        "otplib",
        "reflect-metadata",
        "rxjs"
      ],
      sourcemap: true,
      logLevel: "info",
      alias: {
        "@wooriai/domain": emittedDomain,
        "@wooriai/contracts": emittedContracts,
        zod: resolve(root, "packages/contracts/node_modules/zod/index.cjs")
      }
    });
  }

  cpSync(resolve(root, "apps/api/prisma"), resolve(outputDir, "prisma"), {
    recursive: true,
    filter: (source) => !source.includes("node_modules")
  });

  console.log(`[build:api] artifacts: ${Object.keys(emittedEntries).map((name) => resolve(outputDir, `${name}.cjs`)).join(", ")}`);
}

void main();
