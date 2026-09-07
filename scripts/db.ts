/**
 * 로컬 PostgreSQL 운영 스크립트
 *
 * 기본은 docker compose(infra/docker/docker-compose.yml)를 사용하고,
 * Docker 데몬을 쓸 수 없는 환경에서는 포터블 PostgreSQL(.toolcache/pg16 또는 PGBIN 환경변수)로
 * 자동 fallback 한다. 클라이언트 바이너리(psql/pg_dump/pg_isready)만 필요한 명령은
 * 마지막으로 PATH의 바이너리도 쓴다.
 *
 * ── 대상(target) 규칙 — 라운드 106 F1로 통일 ──────────────────────────────
 * 종전: `backup`·`restore`는 파일 상단 리터럴(`wooriai_dev`@localhost)로 **고정**됐고
 *       `reset`은 `pnpmApi()`를 통해 `DATABASE_URL`을 **물려받았다**. 그래서 운영
 *       `DATABASE_URL`이 export된 셸에서 문서의 검증 절차(backup → reset → restore)를
 *       그대로 따르면 **dev를 백업하고 운영을 지우고 dev에 복원했다**. 세 명령 모두
 *       성공 종료했고 어느 줄도 대상을 출력하지 않았다.
 * 현재: 모든 명령이 `resolveTarget()` 하나로 대상을 정하고(§우선순위), 실행 **전에**
 *       대상을 한 줄 출력하며, 파괴적 명령(`reset`·`restore`)은 대상이 로컬 dev가
 *       아니면 명시적 확인 없이는 진행하지 않는다.
 *
 * 우선순위: `--url=<postgres URL>` > `DATABASE_URL` > 문서화된 로컬 dev 기본값.
 * "모르면 멈춘다": `DATABASE_URL`이 있는데 파싱할 수 없거나 postgres URL이 아니면
 * 조용히 dev로 되돌아가지 않고 **에러로 멈춘다**.
 *
 * 왜 "전부 DATABASE_URL 존중"인가(다른 선택지는 "전부 명시 인자 요구"였다):
 * `status|start|migrate|seed`는 CLAUDE.md와 릴리즈 게이트(scripts/release-gate.ts의
 * `db-start` 단계)가 인자 없이 매일 부르는 명령이라 인자 강제는 일상 루프와 게이트를
 * 깨뜨린다. 결함의 뿌리는 "인자가 없다"가 아니라 "명령마다 대상이 다르고 아무도 그것을
 * 출력하지 않는다"였다. 그래서 규칙은 하나로 모으고, 위험은 인자가 아니라 **출력 +
 * 확인 관문**으로 막는다.
 *
 * 사용법: pnpm db <command> [--url=<postgres URL>] [--confirm=<DB이름>]
 *   start    postgres 시작 (로컬 서버 전용)
 *   stop     postgres 중지 (로컬 서버 전용)
 *   status   대상 접속 상태 확인
 *   migrate  prisma migrate deploy
 *   seed     prisma seed 실행
 *   reset    DB 스키마 초기화(migrate reset --force) — 데이터 전부 삭제
 *   backup   pg_dump로 백업 생성 → artifacts/db-backups/wooriai-<DB이름>-<timestamp>.sql
 *   restore  <파일경로> 백업을 복원 — 대상 데이터를 덮어쓴다
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, resolve } from "node:path";
import { packageManagerInvocation } from "./lib/release-gate-runner";

const repoRoot = resolve(__dirname, "..");
const composeFile = resolve(repoRoot, "infra/docker/docker-compose.yml");
const backupDir = resolve(repoRoot, "artifacts/db-backups");
const dbUser = "wooriai";
const dbPassword = "wooriai_dev_password";
const dbName = "wooriai_dev";
const containerService = "postgres";
const portablePgBin = process.env.PGBIN ?? resolve(repoRoot, ".toolcache/pg16/pgsql/bin");
const portablePgData = resolve(repoRoot, ".toolcache/pgdata");
const portablePgLog = resolve(repoRoot, ".toolcache/pglog.txt");

/** 문서(`docs/operations/local-postgres.md`)와 CLAUDE.md가 적는 로컬 dev 기본 대상. */
const defaultDatabaseUrl = `postgresql://${dbUser}:${dbPassword}@localhost:5432/${dbName}`;
/** 확인 관문을 통과시키는 환경변수 — 값은 대상 DB 이름과 정확히 같아야 한다. */
const confirmEnvKey = "WOORIAI_DB_CONFIRM";

type TargetSource = "--url 인자" | "DATABASE_URL" | "기본값(로컬 dev)";

type Target = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  /** 비밀번호를 지운 표시용 URL. */
  displayUrl: string;
  /** prisma에 그대로 넘길 원본 URL. */
  url: string;
  source: TargetSource;
};

function parseTarget(raw: string, source: TargetSource): Target {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      `[db] ${source}의 값을 postgres URL로 읽을 수 없습니다. 대상을 확정할 수 없어 중단합니다.\n` +
        `      기대 형식: postgresql://<user>:<password>@<host>:<port>/<database>`
    );
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(
      `[db] ${source}의 프로토콜이 postgres가 아닙니다(${parsed.protocol}). 대상을 확정할 수 없어 중단합니다.`
    );
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!database) {
    throw new Error(`[db] ${source}에 데이터베이스 이름이 없습니다. 대상을 확정할 수 없어 중단합니다.`);
  }
  const host = parsed.hostname || "localhost";
  const port = parsed.port ? Number(parsed.port) : 5432;
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`[db] ${source}의 포트를 읽을 수 없습니다(${parsed.port}).`);
  }
  const user = parsed.username ? decodeURIComponent(parsed.username) : dbUser;
  const password = parsed.password ? decodeURIComponent(parsed.password) : "";
  return {
    host,
    port,
    user,
    password,
    database,
    displayUrl: `postgresql://${user}${password ? ":***" : ""}@${host}:${port}/${database}`,
    url: raw,
    source
  };
}

/** 로컬 루프백인가 — 확인 관문과 "로컬 서버 경로 사용 가능" 판정의 절반. */
function isLocalHost(host: string): boolean {
  return ["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"].includes(host.toLowerCase());
}

/**
 * 파괴적 명령을 확인 없이 통과시켜도 되는 대상인가.
 * 판정: 호스트가 루프백이고 **그리고** DB 이름이 `_dev`로 끝난다. 둘 중 하나라도 아니면
 * 운영일 수 있다고 보고 확인을 요구한다(`wooriai_test`도 확인 대상이다 — 테스트 DB는
 * `apps/api/test/global-setup.ts`가 스스로 초기화하므로 이 스크립트로 지울 일이 없다).
 */
function isLocalDevTarget(target: Target): boolean {
  return isLocalHost(target.host) && target.database.endsWith("_dev");
}

function resolveTarget(flags: Map<string, string>): Target {
  const flagUrl = flags.get("url");
  if (flagUrl) {
    return parseTarget(flagUrl, "--url 인자");
  }
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && envUrl.trim() !== "") {
    return parseTarget(envUrl.trim(), "DATABASE_URL");
  }
  return parseTarget(defaultDatabaseUrl, "기본값(로컬 dev)");
}

/** 모든 명령이 실행 **전에** 부른다 — 이 한 줄이 없던 것이 F1 결함의 뿌리였다. */
function printTarget(command: string, target: Target, note?: string) {
  console.log(`[db] 명령: ${command}`);
  console.log(`[db] 대상: ${target.displayUrl}  (출처: ${target.source})`);
  console.log(`[db] 성격: ${isLocalDevTarget(target) ? "로컬 dev" : "⚠️ 로컬 dev 아님 — 운영일 수 있음"}`);
  if (note) {
    console.log(`[db] ${note}`);
  }
}

/**
 * 파괴적 명령(`reset`·`restore`)의 확인 관문.
 * 대상이 로컬 dev면 그대로 진행하고, 아니면 대상 DB 이름을 사람이 직접 다시 적어야 한다
 * (`--confirm=<DB이름>` 또는 `WOORIAI_DB_CONFIRM=<DB이름>`). 대화형 프롬프트를 쓰지 않는
 * 이유는 CI·비대화형 셸에서 조용히 멈추거나 조용히 통과하는 쪽이 더 위험하기 때문이다.
 */
function assertDestructiveAllowed(command: string, target: Target, flags: Map<string, string>) {
  if (isLocalDevTarget(target)) {
    return;
  }
  const confirmation = flags.get("confirm") ?? process.env[confirmEnvKey] ?? "";
  if (confirmation === target.database) {
    console.warn(`[db] ⚠️ 로컬 dev가 아닌 대상에 ${command}을(를) 진행합니다 — 확인값 일치(${target.database}).`);
    return;
  }
  console.error(
    [
      `[db] 중단: ${command}은(는) 대상 데이터를 파괴합니다.`,
      `[db] 대상 ${target.displayUrl} 은(는) 로컬 dev가 아닙니다`,
      `[db]   (호스트가 루프백이 아니거나 DB 이름이 "_dev"로 끝나지 않음).`,
      confirmation
        ? `[db] 확인값이 대상 DB 이름과 다릅니다: 받은 값 "${confirmation}", 기대 값 "${target.database}".`
        : `[db] 확인값이 없습니다.`,
      `[db] 정말 이 DB를 대상으로 하려면 대상 DB 이름을 그대로 다시 적으세요:`,
      `[db]   pnpm db ${command} --confirm=${target.database}`,
      `[db]   또는 ${confirmEnvKey}=${target.database} pnpm db ${command}`,
      `[db] 로컬 dev를 대상으로 하려면 DATABASE_URL을 비우거나 --url=${defaultDatabaseUrl} 를 쓰세요.`
    ].join("\n")
  );
  process.exit(1);
}

let dockerAvailableCache: boolean | null = null;

/** docker 데몬 조회는 최대 8초라 명령마다 여러 번 부르지 않도록 한 번만 재고 캐시한다. */
function dockerAvailable(): boolean {
  if (dockerAvailableCache === null) {
    try {
      execFileSync("docker", ["version", "--format", "{{.Server.Version}}"], {
        stdio: "pipe",
        timeout: 8000
      });
      dockerAvailableCache = true;
    } catch {
      dockerAvailableCache = false;
    }
  }
  return dockerAvailableCache;
}

function exeSuffix() {
  return process.platform === "win32" ? ".exe" : "";
}

function portableAvailable(): boolean {
  return existsSync(resolve(portablePgBin, `pg_ctl${exeSuffix()}`));
}

function pgExe(name: string) {
  return resolve(portablePgBin, `${name}${exeSuffix()}`);
}

/** PATH에서 클라이언트 바이너리를 찾는다(서버 기동용 pg_ctl/initdb에는 쓰지 않는다). */
function pathPgExe(name: string): string | null {
  const file = `${name}${exeSuffix()}`;
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (dir && existsSync(resolve(dir, file))) {
      return resolve(dir, file);
    }
  }
  return null;
}

type Client =
  | { kind: "docker" }
  | { kind: "portable" }
  | { kind: "path" };

/**
 * psql/pg_dump/pg_isready를 어떤 경로로 실행할지 고른다.
 * 순서는 종전 동작을 유지한다(docker 우선 → 포터블). 셋 다 없던 종전에는 명령이
 * 알 수 없는 오류로 죽었으므로 PATH 바이너리를 마지막 fallback으로 더했다.
 */
function resolveClient(useDocker: boolean, tool: string): Client {
  if (useDocker) {
    return { kind: "docker" };
  }
  if (portableAvailable()) {
    return { kind: "portable" };
  }
  if (pathPgExe(tool)) {
    return { kind: "path" };
  }
  throw new Error(
    `[db] ${tool}을(를) 실행할 경로가 없습니다. Docker를 켜거나 PGBIN(포터블 PostgreSQL) 또는 PATH에 PostgreSQL 클라이언트를 두세요.`
  );
}

type PgToolOptions = {
  target: Target;
  /** 대상 DB 대신 다른 DB로 접속할 때(예: CREATE DATABASE는 postgres DB에서). */
  database?: string;
  input?: string;
  capture?: boolean;
  maxBuffer?: number;
};

/** docker 컨테이너 안에서는 루프백 5432를 유닉스 소켓으로 붙는다(종전과 같은 인증 경로). */
function connectionArgs(client: Client, target: Target, database: string): string[] {
  const socketInsideContainer = client.kind === "docker" && isLocalHost(target.host) && target.port === 5432;
  const hostArgs = socketInsideContainer ? [] : ["-h", target.host, "-p", String(target.port)];
  return [...hostArgs, "-U", target.user, "-d", database];
}

function runPgTool(tool: string, args: string[], options: PgToolOptions): string {
  const useDocker = dockerAvailable();
  const client = resolveClient(useDocker, tool);
  const database = options.database ?? options.target.database;
  const connection = connectionArgs(client, options.target, database);
  const password = options.target.password || dbPassword;
  const stdio: "pipe" | "inherit" | ("pipe" | "inherit")[] = options.capture
    ? options.input
      ? ["pipe", "pipe", "inherit"]
      : "pipe"
    : options.input
      ? ["pipe", "inherit", "inherit"]
      : "inherit";

  if (client.kind === "docker") {
    return (
      execFileSync(
        "docker",
        [
          "compose",
          "-f",
          composeFile,
          "exec",
          "-T",
          "-e",
          `PGPASSWORD=${password}`,
          containerService,
          tool,
          ...connection,
          ...args
        ],
        {
          cwd: repoRoot,
          input: options.input,
          stdio,
          encoding: "utf8",
          maxBuffer: options.maxBuffer
        }
      ) ?? ""
    );
  }

  const executable = client.kind === "portable" ? pgExe(tool) : (pathPgExe(tool) as string);
  return (
    execFileSync(executable, [...connection, ...args], {
      cwd: repoRoot,
      env: { ...process.env, PGPASSWORD: password },
      input: options.input,
      stdio,
      encoding: "utf8",
      maxBuffer: options.maxBuffer
    }) ?? ""
  );
}

function compose(args: string[]) {
  return execFileSync("docker", ["compose", "-f", composeFile, ...args], {
    stdio: "inherit",
    cwd: repoRoot
  });
}

function composeCapture(args: string[]): string {
  return execFileSync("docker", ["compose", "-f", composeFile, ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

/**
 * prisma를 돌리는 명령(migrate/seed/reset)도 같은 대상을 쓴다.
 * 종전에는 `process.env.DATABASE_URL ?? 로컬기본값`이라 호출부가 대상을 알 수 없었다.
 */
function pnpmApi(args: string[], target: Target) {
  const invocation = packageManagerInvocation(["--filter", "api", ...args]);
  execFileSync(invocation.executable, invocation.args, {
    stdio: "inherit",
    cwd: repoRoot,
    env: {
      ...process.env,
      DATABASE_URL: target.url
    }
  });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function sleepSeconds(seconds: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, seconds * 1000);
}

function waitForDockerHealthy(maxSeconds = 60) {
  const startedAt = Date.now();
  for (;;) {
    try {
      const output = composeCapture(["ps", "--format", "json", containerService]);
      if (output.includes('"healthy"')) {
        return;
      }
    } catch {
      // 컨테이너가 아직 조회되지 않으면 재시도
    }
    if ((Date.now() - startedAt) / 1000 > maxSeconds) {
      throw new Error(`postgres 컨테이너가 ${maxSeconds}초 안에 healthy 상태가 되지 않았습니다.`);
    }
    sleepSeconds(2);
  }
}

function portableReady(): boolean {
  try {
    execFileSync(pgExe("pg_isready"), ["-h", "localhost", "-p", "5432"], {
      stdio: "pipe",
      env: { ...process.env, PGPASSWORD: dbPassword }
    });
    return true;
  } catch {
    return false;
  }
}

function targetReady(target: Target): boolean {
  try {
    runPgTool("pg_isready", [], { target, capture: true });
    return true;
  } catch {
    return false;
  }
}

function ensureDatabases(target: Target) {
  for (const database of [target.database, "wooriai_test"]) {
    const exists = runPgTool("psql", ["-tAc", `SELECT 1 FROM pg_database WHERE datname='${database}'`], {
      target,
      database: "postgres",
      capture: true
    });
    if (exists.trim() !== "1") {
      runPgTool("psql", ["-tAc", `CREATE DATABASE ${database};`], {
        target,
        database: "postgres",
        capture: true
      });
    }
  }
}

function startPortable() {
  if (!portableAvailable()) {
    throw new Error(
      `Docker를 쓸 수 없고 포터블 PostgreSQL도 없습니다. ${portablePgBin} 에 PostgreSQL 16 바이너리를 두거나 PGBIN 환경변수를 지정하세요.`
    );
  }
  if (!existsSync(portablePgData)) {
    mkdirSync(resolve(repoRoot, ".toolcache"), { recursive: true });
    const pwFile = resolve(repoRoot, ".toolcache/pgpass.txt");
    writeFileSync(pwFile, dbPassword, "utf8");
    execFileSync(
      pgExe("initdb"),
      ["-D", portablePgData, "-U", dbUser, `--pwfile=${pwFile}`, "-E", "UTF8", "-A", "scram-sha-256"],
      { stdio: "inherit" }
    );
  }
  if (!portableReady()) {
    execFileSync(pgExe("pg_ctl"), ["-D", portablePgData, "-l", portablePgLog, "-o", "-p 5432", "-W", "start"], {
      stdio: "ignore",
      windowsHide: true
    });
    for (let i = 0; i < 60 && !portableReady(); i += 1) {
      sleepSeconds(1);
    }
    if (!portableReady()) {
      throw new Error("PORTABLE_POSTGRES_START_TIMEOUT: 포터블 PostgreSQL이 60초 안에 준비되지 않았습니다.");
    }
  }
}

/**
 * `start`·`stop`은 **로컬 서버**만 제어한다(원격 관리형 DB는 켜고 끌 수 없다).
 * 대상이 원격이면 대상 그대로가 아니라 로컬 기본값을 쓰고, 그 사실을 출력한다.
 */
function localServerTarget(target: Target): Target {
  return isLocalHost(target.host) ? target : parseTarget(defaultDatabaseUrl, "기본값(로컬 dev)");
}

function parseArgv(argv: string[]) {
  const flags = new Map<string, string>();
  const positional: string[] = [];
  for (const raw of argv) {
    if (raw.startsWith("--")) {
      const [key, ...rest] = raw.slice(2).split("=");
      flags.set(key, rest.join("="));
    } else {
      positional.push(raw);
    }
  }
  return { flags, positional };
}

function main() {
  const { flags, positional } = parseArgv(process.argv.slice(2));
  const [command, arg] = positional;
  const useDocker = dockerAvailable();

  const knownCommands = ["start", "stop", "status", "migrate", "seed", "reset", "backup", "restore"];
  if (!command || !knownCommands.includes(command)) {
    console.error(
      "[db] 명령: start | stop | status | migrate | seed | reset | backup | restore <file>\n" +
        "[db] 공통 옵션: --url=<postgres URL> (없으면 DATABASE_URL, 그것도 없으면 로컬 dev 기본값)\n" +
        "[db]           --confirm=<DB이름> (reset·restore가 로컬 dev 밖을 대상으로 할 때 필요)"
    );
    process.exit(1);
  }

  const target = resolveTarget(flags);

  switch (command) {
    case "start": {
      const serverTarget = localServerTarget(target);
      printTarget(
        command,
        serverTarget,
        serverTarget === target
          ? "start/stop은 로컬 postgres 서버만 제어합니다."
          : `⚠️ ${target.displayUrl} 은(는) 원격이라 기동 대상이 아닙니다 — 로컬 서버만 제어합니다.`
      );
      if (useDocker) {
        compose(["up", "-d", containerService]);
        waitForDockerHealthy();
        ensureDatabases(serverTarget);
        console.log("[db] postgres 준비 완료 (docker, localhost:5432)");
      } else {
        console.warn("[db] Docker 데몬에 접속할 수 없어 포터블 PostgreSQL로 시작합니다.");
        startPortable();
        ensureDatabases(serverTarget);
        console.log("[db] 포터블 postgres 준비 완료 (localhost:5432)");
      }
      return;
    }
    case "stop": {
      const serverTarget = localServerTarget(target);
      printTarget(command, serverTarget, "start/stop은 로컬 postgres 서버만 제어합니다.");
      if (useDocker) {
        compose(["stop", containerService]);
      } else if (portableAvailable()) {
        execFileSync(pgExe("pg_ctl"), ["-D", portablePgData, "stop"], {
          stdio: "inherit"
        });
      }
      return;
    }
    case "status": {
      printTarget(command, target, "읽기만 합니다.");
      if (useDocker) {
        compose(["ps", containerService]);
      }
      if (targetReady(target)) {
        console.log(`[db] ${target.host}:${target.port}/${target.database} 접속 가능`);
      } else {
        console.error("[db] 접속 불가 — pnpm db start 를 먼저 실행하거나 대상 URL을 확인하세요.");
        process.exitCode = 1;
      }
      return;
    }
    case "migrate": {
      printTarget(command, target, "이 DB에 pending 마이그레이션을 전부 적용합니다.");
      pnpmApi(["prisma:deploy"], target);
      return;
    }
    case "seed": {
      printTarget(command, target, "이 DB에 시드를 upsert 합니다(멱등).");
      pnpmApi(["seed"], target);
      return;
    }
    case "reset": {
      printTarget(command, target, "⚠️ 이 DB의 데이터를 전부 삭제하고 스키마를 다시 만듭니다.");
      assertDestructiveAllowed(command, target, flags);
      pnpmApi(["exec", "prisma", "migrate", "reset", "--force", "--schema", "prisma/schema.prisma"], target);
      return;
    }
    case "backup": {
      printTarget(command, target, "이 DB를 읽어 덤프 파일을 만듭니다(대상은 변경하지 않음).");
      if (!existsSync(backupDir)) {
        mkdirSync(backupDir, { recursive: true });
      }
      const file = resolve(backupDir, `wooriai-${target.database}-${timestamp()}.sql`);
      const dump = runPgTool("pg_dump", ["--clean", "--if-exists"], {
        target,
        capture: true,
        maxBuffer: 512 * 1024 * 1024
      });
      writeFileSync(file, dump, "utf8");
      console.log(`[db] 백업 생성: ${file} (${Math.round(dump.length / 1024)} KB)`);
      console.log(`[db] 백업 대상: ${target.displayUrl}`);
      return;
    }
    case "restore": {
      if (!arg) {
        console.error("[db] 사용법: pnpm db restore <백업파일.sql> [--confirm=<DB이름>]");
        process.exit(1);
      }
      const file = resolve(arg);
      if (!existsSync(file)) {
        console.error(`[db] 백업 파일이 없습니다: ${file}`);
        process.exit(1);
      }
      printTarget(command, target, `⚠️ 이 DB를 ${file} 의 내용으로 덮어씁니다(--clean 덤프는 기존 객체를 drop).`);
      assertDestructiveAllowed(command, target, flags);
      const sql = readFileSync(file, "utf8");
      runPgTool("psql", [], { target, input: sql });
      console.log(`[db] 복원 완료: ${file} → ${target.displayUrl}`);
      return;
    }
    default: {
      // knownCommands 검사에서 이미 걸러진다.
      process.exit(1);
    }
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
