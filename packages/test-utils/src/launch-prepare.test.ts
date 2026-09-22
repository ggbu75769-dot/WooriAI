import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");
const temporaryRoots: string[] = [];
const htmlTargets = [
  "infra/legal/terms-of-service.html", "infra/legal/privacy-policy.html", "infra/legal/account-deletion.html",
  "infra/site/index.html", "infra/site/faq.html", "infra/site/support.html"
];
const template = '<p>[운영 주체명] · [지원 이메일] · [출시일]</p><p>[적용 법령·기간은 법률 검토 시 확정]</p>';
const config = {
  operatorName: "우리아이 & 부모 <운영>", supportEmail: "help@wooriai.test", domain: "api.wooriai.test",
  launchDate: "2026-09-15", siteDomain: "wooriai.test", kakao: { restApiKey: "synthetic-kakao-key", clientSecret: "synthetic-kakao-secret" }
};

function fixture(overrides = {}) {
  const directory = mkdtempSync(join(tmpdir(), "wooriai-launch-test-"));
  temporaryRoots.push(directory);
  mkdirSync(join(directory, "scripts/launch"), { recursive: true });
  copyFileSync(join(root, "scripts/launch/prepare.ts"), join(directory, "scripts/launch/prepare.ts"));
  copyFileSync(join(root, "scripts/check-env.ts"), join(directory, "scripts/check-env.ts"));
  copyFileSync(join(root, ".env.example"), join(directory, ".env.example"));
  writeFileSync(join(directory, "launch.config.json"), JSON.stringify({ ...config, ...overrides }));
  writeFileSync(join(directory, ".gitignore"), "existing-rule\n");
  for (const file of htmlTargets) {
    mkdirSync(dirname(join(directory, file)), { recursive: true });
    writeFileSync(join(directory, file), template);
  }
  return directory;
}

function cli(cwd: string, args: string[] = []) {
  return spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), join(root, "scripts/launch/prepare.ts"), ...args], {
    cwd, encoding: "utf8", timeout: 30_000, windowsHide: true
  });
}

afterEach(() => {
  for (const directory of temporaryRoots.splice(0)) {
    if (dirname(resolve(directory)) !== resolve(tmpdir()) || !directory.startsWith(join(tmpdir(), "wooriai-launch-test-"))) {
      throw new Error("Refusing cleanup outside the owned temporary directory");
    }
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("launch preparation on the host platform", () => {
  it("previews valid settings without writing HTML, secrets, or ignore rules", () => {
    const directory = fixture();
    const result = cli(directory, ["--check"]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("CHECK_ONLY");
    expect(existsSync(join(directory, ".env.production"))).toBe(false);
    expect(readFileSync(join(directory, ".gitignore"), "utf8")).toBe("existing-rule\n");
    for (const file of htmlTargets) expect(readFileSync(join(directory, file), "utf8")).toBe(template);
  });

  it("creates validated configuration on Windows too, escapes legal text, and preserves existing secrets on repeat", () => {
    const directory = fixture();
    const first = cli(directory);
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toContain(".env.example drift guard OK");
    const env = readFileSync(join(directory, ".env.production"), "utf8");
    expect(env).toContain("EXPO_PUBLIC_API_BASE_URL=https://api.wooriai.test/api/v1");
    expect(env).toContain("EXPO_PUBLIC_KAKAO_ENABLED=1");
    expect(env).toContain("EXPO_PUBLIC_KAKAO_REDIRECT_URI=https://api.wooriai.test/api/v1/auth/kakao/callback");
    expect(env).toContain("OAUTH_KAKAO_REDIRECT_URIS=https://api.wooriai.test/api/v1/auth/kakao/callback");
    expect(env).toContain(`OAUTH_KAKAO_CLIENT_SECRET=${config.kakao.clientSecret}`);
    expect(first.stdout + first.stderr).not.toContain(config.kakao.restApiKey);
    expect(first.stdout + first.stderr).not.toContain(config.kakao.clientSecret);
    for (const file of htmlTargets) {
      const html = readFileSync(join(directory, file), "utf8");
      expect(html).toContain("우리아이 &amp; 부모 &lt;운영&gt;");
      expect(html).toContain("[적용 법령·기간은 법률 검토 시 확정]");
    }
    const second = cli(directory);
    expect(second.status, second.stderr).toBe(0);
    expect(readFileSync(join(directory, ".env.production"), "utf8")).toBe(env);
  });

  it("does not partially replace earlier pages if a later page is missing", () => {
    const directory = fixture();
    rmSync(join(directory, htmlTargets.at(-1)!));
    expect(cli(directory).status).toBe(1);
    expect(readFileSync(join(directory, htmlTargets[0]), "utf8")).toBe(template);
    expect(existsSync(join(directory, ".env.production"))).toBe(false);
  });

  it("does not echo a malformed config containing a key", () => {
    const directory = fixture();
    const secret = "PRIVATE_KAKAO_MARKER";
    writeFileSync(join(directory, "launch.config.json"), `${secret}{`);
    const result = cli(directory);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain(secret);
    expect(existsSync(join(directory, ".env.production"))).toBe(false);
  });

  it.each([{ args: [] }, { args: ["--check"] }])("rejects invalid existing environment without changing pages: %j", ({ args }) => {
    const directory = fixture();
    const env = "JWT_ACCESS_SECRET=PRIVATE_EXISTING_MARKER\n";
    writeFileSync(join(directory, ".env.production"), env);
    const result = cli(directory, args);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain("PRIVATE_EXISTING_MARKER");
    expect(readFileSync(join(directory, ".env.production"), "utf8")).toBe(env);
    expect(readFileSync(join(directory, ".gitignore"), "utf8")).toBe("existing-rule\n");
    for (const file of htmlTargets) expect(readFileSync(join(directory, file), "utf8")).toBe(template);
  });

  it.each([{ args: [] }, { args: ["--force-env"] }])("does not persist generated secrets or HTML when environment validation fails: %j", ({ args }) => {
    const directory = fixture();
    const existing = "JWT_ACCESS_SECRET=PRIVATE_EXISTING_MARKER\n";
    if (args.length) writeFileSync(join(directory, ".env.production"), existing);
    writeFileSync(join(directory, ".env.example"), "UNKNOWN_CONFIG_KEY=x\n");
    const result = cli(directory, args);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain("PRIVATE_EXISTING_MARKER");
    if (args.length) expect(readFileSync(join(directory, ".env.production"), "utf8")).toBe(existing);
    else expect(existsSync(join(directory, ".env.production"))).toBe(false);
    expect(readFileSync(join(directory, ".gitignore"), "utf8")).toBe("existing-rule\n");
    for (const file of htmlTargets) expect(readFileSync(join(directory, file), "utf8")).toBe(template);
  });

  it.each([{ args: [] }, { args: ["--check"] }])("detects domain and Kakao drift without rotating secrets: %j", ({ args }) => {
    const directory = fixture();
    expect(cli(directory).status).toBe(0);
    const existing = readFileSync(join(directory, ".env.production"), "utf8");
    for (const file of htmlTargets) writeFileSync(join(directory, file), template);
    writeFileSync(join(directory, "launch.config.json"), JSON.stringify({ ...config, domain: "new.wooriai.test", kakao: { restApiKey: "PRIVATE_NEW_KEY", clientSecret: "PRIVATE_NEW_SECRET" } }));
    const result = cli(directory, args);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ENV_CONFIG_DRIFT");
    expect(result.stderr).toContain("EXPO_PUBLIC_API_BASE_URL");
    expect(result.stderr).toContain("OAUTH_KAKAO_CLIENT_ID");
    expect(result.stderr).toContain("OAUTH_KAKAO_CLIENT_SECRET");
    expect(result.stdout + result.stderr).not.toContain("PRIVATE_NEW_KEY");
    expect(result.stdout + result.stderr).not.toContain("PRIVATE_NEW_SECRET");
    expect(readFileSync(join(directory, ".env.production"), "utf8")).toBe(existing);
    for (const file of htmlTargets) expect(readFileSync(join(directory, file), "utf8")).toBe(template);
  });

  it.each([null, [], { kakao: null }])("rejects an invalid config shape without an uncaught exception: %j", (invalid) => {
    const directory = fixture();
    writeFileSync(join(directory, "launch.config.json"), JSON.stringify(invalid === null || Array.isArray(invalid) ? invalid : { ...config, ...invalid }));
    const result = cli(directory);
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain("TypeError");
    expect(existsSync(join(directory, ".env.production"))).toBe(false);
  });

  it("rejects multiline dotenv input before changing any page", () => {
    const directory = fixture({ kakao: { restApiKey: "PRIVATE_MARKER\nEXPO_PUBLIC_KAKAO_ENABLED=0" } });
    const result = cli(directory);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain("PRIVATE_MARKER");
    expect(readFileSync(join(directory, htmlTargets[0]), "utf8")).toBe(template);
  });

  it("reports missing Kakao separately from a successful configuration preview", () => {
    const directory = fixture({ kakao: { restApiKey: "" } });
    const result = cli(directory, ["--check"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("KAKAO_NOT_CONFIGURED");
    expect(result.stdout).toContain("NOT_RELEASE_READY");
    expect(existsSync(join(directory, ".env.production"))).toBe(false);
  });

  it("rejects a configured REST key without its server secret before writing anything", () => {
    const directory = fixture({ kakao: { restApiKey: "synthetic-key" } });
    const result = cli(directory);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("kakao.clientSecret");
    expect(existsSync(join(directory, ".env.production"))).toBe(false);
    for (const file of htmlTargets) expect(readFileSync(join(directory, file), "utf8")).toBe(template);
  });

  it("rejects conflicting preview and secret-rotation options", () => {
    const directory = fixture();
    const envFile = join(directory, ".env.production");
    writeFileSync(envFile, "JWT_ACCESS_SECRET=existing-secret\n");
    const result = cli(directory, ["--check", "--force-env"]);
    expect(result.status).toBe(1);
    expect(readFileSync(envFile, "utf8")).toBe("JWT_ACCESS_SECRET=existing-secret\n");
  });
});
