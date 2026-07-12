/**
 * 로컬 PostgreSQL 운영 스크립트
 *
 * 기본은 docker compose(infra/docker/docker-compose.yml)를 사용하고,
 * Docker 데몬을 쓸 수 없는 환경에서는 포터블 PostgreSQL(.toolcache/pg16 또는 PGBIN 환경변수)로
 * 자동 fallback 한다. 두 경로 모두 동일한 계정/DB(wooriai / wooriai_dev, localhost:5432)를 쓴다.
 *
 * 사용법: pnpm db <command>
 *   start    postgres 시작
 *   stop     postgres 중지
 *   status   접속 상태 확인
 *   migrate  prisma migrate deploy
 *   seed     prisma seed 실행
 *   reset    DB 스키마 초기화(migrate reset --force) — 개발 전용, 데이터 전부 삭제
 *   backup   pg_dump로 백업 생성 → artifacts/db-backups/<timestamp>.sql
 *   restore  <파일경로> 백업을 복원
 */
import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "..");
const composeFile = resolve(repoRoot, "infra/docker/docker-compose.yml");
const backupDir = resolve(repoRoot, "artifacts/db-backups");
const dbUser = "wooriai";
const dbPassword = "wooriai_dev_password";
const dbName = "wooriai_dev";
const containerService = "postgres";
const portablePgBin =
  process.env.PGBIN ?? resolve(repoRoot, ".toolcache/pg16/pgsql/bin");
const portablePgData = resolve(repoRoot, ".toolcache/pgdata");
const portablePgLog = resolve(repoRoot, ".toolcache/pglog.txt");

function dockerAvailable(): boolean {
  try {
    execFileSync("docker", ["version", "--format", "{{.Server.Version}}"], {
      stdio: "pipe",
      timeout: 8000
    });
    return true;
  } catch {
    return false;
  }
}

function portableAvailable(): boolean {
  const exe = process.platform === "win32" ? ".exe" : "";
  return existsSync(resolve(portablePgBin, `pg_ctl${exe}`));
}

function pgExe(name: string) {
  const exe = process.platform === "win32" ? ".exe" : "";
  return resolve(portablePgBin, `${name}${exe}`);
}

function portableEnv() {
  return { ...process.env, PGPASSWORD: dbPassword };
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

function pnpmApi(args: string[]) {
  execSync(`pnpm --filter api ${args.join(" ")}`, {
    stdio: "inherit",
    cwd: repoRoot,
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ??
        `postgresql://${dbUser}:${dbPassword}@localhost:5432/${dbName}`
    }
  });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function sleepSeconds(seconds: number) {
  execSync(
    process.platform === "win32"
      ? `timeout /t ${seconds} /nobreak >nul`
      : `sleep ${seconds}`
  );
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
      env: portableEnv()
    });
    return true;
  } catch {
    return false;
  }
}

function startPortable() {
  if (!portableAvailable()) {
    throw new Error(
      `Docker를 쓸 수 없고 포터블 PostgreSQL도 없습니다. ${portablePgBin} 에 PostgreSQL 16 바이너리를 두거나 PGBIN 환경변수를 지정하세요.`
    );
  }
  if (!existsSync(portablePgData)) {
    const pwFile = resolve(repoRoot, ".toolcache/pgpass.txt");
    writeFileSync(pwFile, dbPassword, "utf8");
    execFileSync(
      pgExe("initdb"),
      ["-D", portablePgData, "-U", dbUser, `--pwfile=${pwFile}`, "-E", "UTF8", "-A", "scram-sha-256"],
      { stdio: "inherit" }
    );
  }
  if (!portableReady()) {
    execFileSync(pgExe("pg_ctl"), ["-D", portablePgData, "-l", portablePgLog, "-o", "-p 5432", "start"], {
      stdio: "inherit"
    });
    for (let i = 0; i < 15 && !portableReady(); i += 1) {
      sleepSeconds(1);
    }
  }
  const dbExists = execFileSync(
    pgExe("psql"),
    ["-U", dbUser, "-h", "localhost", "-d", "postgres", "-tAc", `SELECT 1 FROM pg_database WHERE datname='${dbName}'`],
    { env: portableEnv(), encoding: "utf8" }
  ).trim();
  if (dbExists !== "1") {
    execFileSync(pgExe("psql"), ["-U", dbUser, "-h", "localhost", "-d", "postgres", "-c", `CREATE DATABASE ${dbName};`], {
      env: portableEnv(),
      stdio: "inherit"
    });
  }
  console.log("[db] 포터블 postgres 준비 완료 (localhost:5432)");
}

function main() {
  const [command, arg] = process.argv.slice(2);
  const useDocker = dockerAvailable();

  switch (command) {
    case "start": {
      if (useDocker) {
        compose(["up", "-d", containerService]);
        waitForDockerHealthy();
        console.log("[db] postgres 준비 완료 (docker, localhost:5432)");
      } else {
        console.warn("[db] Docker 데몬에 접속할 수 없어 포터블 PostgreSQL로 시작합니다.");
        startPortable();
      }
      return;
    }
    case "stop": {
      if (useDocker) {
        compose(["stop", containerService]);
      } else if (portableAvailable()) {
        execFileSync(pgExe("pg_ctl"), ["-D", portablePgData, "stop"], { stdio: "inherit" });
      }
      return;
    }
    case "status": {
      if (useDocker) {
        compose(["ps", containerService]);
      }
      const ready = portableAvailable()
        ? portableReady()
        : (() => {
            try {
              compose(["exec", "-T", containerService, "pg_isready", "-U", dbUser, "-d", dbName]);
              return true;
            } catch {
              return false;
            }
          })();
      if (ready) {
        console.log("[db] localhost:5432 접속 가능");
      } else {
        console.error("[db] 접속 불가 — pnpm db start 를 먼저 실행하세요.");
        process.exitCode = 1;
      }
      return;
    }
    case "migrate": {
      pnpmApi(["prisma:deploy"]);
      return;
    }
    case "seed": {
      pnpmApi(["seed"]);
      return;
    }
    case "reset": {
      pnpmApi(["exec", "prisma", "migrate", "reset", "--force", "--schema", "prisma/schema.prisma"]);
      return;
    }
    case "backup": {
      if (!existsSync(backupDir)) {
        mkdirSync(backupDir, { recursive: true });
      }
      const file = resolve(backupDir, `wooriai-${timestamp()}.sql`);
      let dump: string;
      if (useDocker) {
        dump = composeCapture([
          "exec",
          "-T",
          containerService,
          "pg_dump",
          "-U",
          dbUser,
          "-d",
          dbName,
          "--clean",
          "--if-exists"
        ]);
      } else {
        dump = execFileSync(
          pgExe("pg_dump"),
          ["-U", dbUser, "-h", "localhost", "-d", dbName, "--clean", "--if-exists"],
          { env: portableEnv(), encoding: "utf8", maxBuffer: 512 * 1024 * 1024 }
        );
      }
      writeFileSync(file, dump, "utf8");
      console.log(`[db] 백업 생성: ${file} (${Math.round(dump.length / 1024)} KB)`);
      return;
    }
    case "restore": {
      if (!arg) {
        console.error("[db] 사용법: pnpm db restore <백업파일.sql>");
        process.exit(1);
      }
      const file = resolve(arg);
      if (!existsSync(file)) {
        console.error(`[db] 백업 파일이 없습니다: ${file}`);
        process.exit(1);
      }
      const sql = readFileSync(file, "utf8");
      if (useDocker) {
        execFileSync("docker", ["compose", "-f", composeFile, "exec", "-T", containerService, "psql", "-U", dbUser, "-d", dbName], {
          input: sql,
          stdio: ["pipe", "inherit", "inherit"],
          cwd: repoRoot
        });
      } else {
        execFileSync(pgExe("psql"), ["-U", dbUser, "-h", "localhost", "-d", dbName], {
          input: sql,
          stdio: ["pipe", "inherit", "inherit"],
          env: portableEnv()
        });
      }
      console.log(`[db] 복원 완료: ${file}`);
      return;
    }
    default: {
      console.error("[db] 명령: start | stop | status | migrate | seed | reset | backup | restore <file>");
      process.exit(1);
    }
  }
}

main();
