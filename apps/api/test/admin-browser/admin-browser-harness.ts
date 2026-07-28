import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Browser } from "playwright-core";
import { chromium } from "playwright-core";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import path from "node:path";
import { AppModule } from "../../src/app.module";
import { configureApiApp } from "../../src/bootstrap";
import { PrismaService } from "../../src/prisma/prisma.service";

const CHROME_CANDIDATES = [
  process.env.WOORIAI_CHROME_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  chromium.executablePath()
].filter((candidate): candidate is string => Boolean(candidate));

async function findFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("BROWSER_PORT_UNAVAILABLE")));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function chromeExecutable(): string {
  const executable = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!executable) {
    throw new Error("RUNTIME_BLOCKED_NO_BROWSER: Chrome or Edge executable was not found.");
  }
  return executable;
}

async function waitForHttp(url: string, processRef: ChildProcess, output: () => string) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (processRef.exitCode !== null) {
      throw new Error(`ADMIN_SERVER_EXITED_${processRef.exitCode}\n${output()}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The server is still compiling or binding its port.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`ADMIN_SERVER_TIMEOUT\n${output()}`);
}

async function stopProcess(processRef: ChildProcess) {
  if (processRef.exitCode !== null || processRef.killed) return;
  processRef.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => processRef.once("exit", () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 5_000))
  ]);
  if (processRef.exitCode === null) {
    processRef.kill("SIGKILL");
  }
}

export type AdminBrowserHarness = {
  app: INestApplication;
  browser: Browser;
  baseUrl: string;
  prisma: PrismaService;
  close: () => Promise<void>;
};

export async function launchAdminBrowserHarness(): Promise<AdminBrowserHarness> {
  const previousRateLimitGlobalMax = process.env.RATE_LIMIT_GLOBAL_MAX;
  const previousRateLimitAuthMax = process.env.RATE_LIMIT_AUTH_MAX;
  const restoreRateLimits = () => {
    if (previousRateLimitGlobalMax === undefined) delete process.env.RATE_LIMIT_GLOBAL_MAX;
    else process.env.RATE_LIMIT_GLOBAL_MAX = previousRateLimitGlobalMax;
    if (previousRateLimitAuthMax === undefined) delete process.env.RATE_LIMIT_AUTH_MAX;
    else process.env.RATE_LIMIT_AUTH_MAX = previousRateLimitAuthMax;
  };
  process.env.JWT_ACCESS_SECRET = "release4g-browser-access-secret";
  process.env.JWT_REFRESH_SECRET = "release4g-browser-refresh-secret";
  process.env.WOORIAI_ADMIN_TOKEN = "release4g-browser-legacy-token";
  process.env.NODE_ENV = "test";
  // A single browser qualification file signs in many isolated role fixtures
  // from localhost. Keep the production defaults intact while giving this
  // bounded test harness enough headroom to exercise every role in sequence.
  process.env.RATE_LIMIT_GLOBAL_MAX = "2000";
  process.env.RATE_LIMIT_AUTH_MAX = "200";

  const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApiApp(app);
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address();
  if (!address || typeof address === "string") {
    await app.close();
    restoreRateLimits();
    throw new Error("BROWSER_API_PORT_UNAVAILABLE");
  }
  const apiUrl = `http://127.0.0.1:${address.port}`;

  const adminPort = await findFreePort();
  const adminRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../admin");
  const nextBin = path.join(adminRoot, "node_modules", "next", "dist", "bin", "next");
  const output: string[] = [];
  const adminProcess = spawn(process.execPath, [nextBin, "dev", "-H", "127.0.0.1", "-p", String(adminPort)], {
    cwd: adminRoot,
    env: {
      ...process.env,
      ADMIN_API_PROXY_TARGET: apiUrl,
      NEXT_TELEMETRY_DISABLED: "1"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  const capture = (chunk: Buffer) => {
    output.push(chunk.toString("utf8"));
    if (output.length > 80) output.splice(0, output.length - 80);
  };
  adminProcess.stdout?.on("data", capture);
  adminProcess.stderr?.on("data", capture);

  const baseUrl = `http://127.0.0.1:${adminPort}`;
  try {
    await waitForHttp(baseUrl, adminProcess, () => output.join(""));
    // The root page becoming reachable does not prove that Next has compiled
    // the catalog route under a heavily loaded release gate. Warm the exact
    // route before the test browser starts, otherwise a
    // browser can land on the transient compilation/error shell and spend its
    // entire locator timeout waiting for a form that is not ready yet.
    await waitForHttp(`${baseUrl}/catalog`, adminProcess, () => output.join(""));
  } catch (error) {
    await stopProcess(adminProcess);
    await app.close();
    restoreRateLimits();
    throw error;
  }

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      executablePath: chromeExecutable(),
      headless: true
    });
    const warmupPage = await browser.newPage();
    try {
      await warmupPage.goto(`${baseUrl}/catalog`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000
      });
      // HTTP 200 alone can still be Next's transient compilation shell. The
      // client-rendered sign-in label is the first stable, interactive marker.
      await warmupPage.getByLabel("관리자 이메일").waitFor({
        state: "visible",
        timeout: 60_000
      });
    } finally {
      await warmupPage.close();
    }
  } catch (error) {
    await browser?.close();
    await stopProcess(adminProcess);
    await app.close();
    restoreRateLimits();
    throw error;
  }

  return {
    app,
    browser,
    baseUrl,
    prisma: moduleRef.get(PrismaService),
    close: async () => {
      await browser.close();
      await stopProcess(adminProcess);
      await app.close();
      restoreRateLimits();
    }
  };
}
