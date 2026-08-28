import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 환경변수 게이트 (GAP-059 #6).
 *
 * 두 단으로 나눈다.
 *  - required: **미주입 시 조용히 오동작하거나 부팅에 실패하는** 키. 없으면 exit 1.
 *  - optional: 코드가 읽되 문서화된 안전한 기본값이 있거나, 꺼짐이 정상인 opt-in 플래그.
 *    존재 여부는 강제하지 않고 `.env.example` 드리프트 가드에만 참여한다.
 *
 * "조용히"가 판정 기준이다. 미설정이 부팅 실패나 로그 경고로 즉시 드러나는 값이라도,
 * 그 실패가 배포 후에야 도착하면(예: DATABASE_URL) required다. 반대로 미설정이 곧
 * "기능 꺼짐"이고 그 상태가 정상 운영인 값(PUSH_ENABLED·LINK_HEALTH_ENABLED 등)은 optional이다.
 *
 * scope는 이 키를 읽는 실행 주체다. 진단 출력과 `--scope` 필터에만 쓰이고 판정에는 영향이 없다.
 */
type EnvScope = "api" | "mobile" | "admin" | "infra";

type EnvSpec = {
  key: string;
  scope: EnvScope;
  /** 미주입 시 실제로 무슨 일이 벌어지는지(required) 또는 기본값이 무엇인지(optional). */
  note: string;
};

const REQUIRED_SPECS: EnvSpec[] = [
  { key: "NODE_ENV", scope: "api", note: "미설정은 dev/test가 아니므로 프로덕션 취급 — 시크릿 폴백이 사라져 부팅 실패" },
  { key: "DATABASE_URL", scope: "api", note: "Prisma 유일 저장 경로 — 미설정 시 API 부팅 실패" },
  {
    key: "TRUST_PROXY",
    scope: "api",
    note: "리버스 프록시 뒤에서 미설정 시 per-IP 레이트리밋이 프록시 IP 하나로 조용히 오집계"
  },
  { key: "JWT_ACCESS_SECRET", scope: "api", note: "assertRequiredSecretsConfigured 부팅 강제" },
  { key: "JWT_REFRESH_SECRET", scope: "api", note: "assertRequiredSecretsConfigured 부팅 강제" },
  { key: "WOORIAI_ADMIN_TOKEN", scope: "api", note: "assertRequiredSecretsConfigured 부팅 강제(어드민 레거시 헤더)" },
  { key: "AFFILIATE_ALLOWED_DOMAINS", scope: "api", note: "미설정 시 제휴 리다이렉트가 dev 폴백 도메인만 허용" },
  { key: "AFFILIATE_CLICK_IP_SALT", scope: "api", note: "미설정 시 공개된 dev salt로 클릭 IP 해시 — 재식별 위험" },
  { key: "ANALYTICS_ANON_SALT", scope: "api", note: "미설정 시 공개된 dev salt로 익명 식별자 생성 — 재식별 위험" },
  {
    key: "INVITE_LINK_BASE_URL",
    scope: "api",
    note: "미설정 시 가족 초대 링크가 wooriai.local로 발급되어 조용히 죽은 링크가 나간다"
  },
  { key: "OAUTH_KAKAO_CLIENT_ID", scope: "api", note: "미설정 시 카카오 OIDC 검증이 dev 폴백 client id로 진행" },
  { key: "OAUTH_KAKAO_REDIRECT_URIS", scope: "api", note: "허용 redirect 목록 — 미설정 시 실 로그인 콜백이 거부" },
  {
    key: "WORKER_ENABLED",
    scope: "api",
    note: "미설정 시 주기 작업(토큰 정리·파기·링크 헬스)이 조용히 한 번도 돌지 않는다 — 끌 때도 0을 명시"
  },
  {
    key: "EXPO_PUBLIC_API_BASE_URL",
    scope: "mobile",
    note: "빌드타임 주입 — 미설정 시 앱이 조용히 http://localhost:3000/api/v1을 본다(기기에서 전부 실패)"
  },
  // --- 라운드 59 이전부터 required였던 키 중 현재 애플리케이션 코드가 직접 읽지 않는 것들 ---
  // 아래 6개는 infra/docker/docker-compose.yml이 컨테이너에 주입하는 스캐폴드 값이거나
  // (REDIS_URL·S3_*), DB로 이관된 뒤 남은 값(AFFILIATE_DISCLOSURE_TEXT는 disclosure 테이블이
  // 단일 소스), 아직 배선되지 않은 소셜 로그인 자리(OAUTH_APPLE/GOOGLE_CLIENT_ID)다.
  // 게이트 무회귀를 위해 required로 유지한다 — 제거는 인프라/제휴 담당 확인 후 별도 변경 요청.
  { key: "REDIS_URL", scope: "infra", note: "docker-compose가 API 컨테이너에 주입(현재 앱 코드는 직접 읽지 않음)" },
  { key: "S3_ENDPOINT", scope: "infra", note: "docker-compose/minio 스캐폴드(현재 앱 코드는 직접 읽지 않음)" },
  { key: "S3_BUCKET", scope: "infra", note: "docker-compose/minio 스캐폴드(현재 앱 코드는 직접 읽지 않음)" },
  { key: "S3_ACCESS_KEY_ID", scope: "infra", note: "minio 자격증명 스캐폴드(현재 앱 코드는 직접 읽지 않음)" },
  { key: "S3_SECRET_ACCESS_KEY", scope: "infra", note: "minio 자격증명 스캐폴드(현재 앱 코드는 직접 읽지 않음)" },
  {
    key: "AFFILIATE_DISCLOSURE_TEXT",
    scope: "api",
    // 라운드 59 통합리뷰 P2-10: "배포 기본값"은 사실이 아니었다 — 이 값을 읽는 코드가 한 줄도
    // 없어서(앱·API·시드 어디에서도 참조하지 않는다) 무엇의 기본값도 되지 못한다. DNC-010 고지
    // 문구의 런타임 단일 소스는 disclosure 테이블이고, 이 키는 위 6개와 같은 "남은 자리"다.
    note: "DNC-010 고지 문구 자리 — 현재 앱/API 코드는 직접 읽지 않음(런타임 단일 소스는 disclosure 테이블)"
  },
  { key: "OAUTH_APPLE_CLIENT_ID", scope: "api", note: "애플 로그인 자리(현재 앱 코드는 직접 읽지 않음)" },
  { key: "OAUTH_GOOGLE_CLIENT_ID", scope: "api", note: "구글 로그인 자리(현재 앱 코드는 직접 읽지 않음)" }
];

const OPTIONAL_SPECS: EnvSpec[] = [
  { key: "PORT", scope: "api", note: "기본 3000" },
  { key: "LOG_LEVEL", scope: "api", note: "기본 info (error|warn|info|debug)" },
  { key: "REFRESH_FAMILY_MAX_AGE_DAYS", scope: "api", note: "기본 90일(SEC-131)" },
  { key: "OAUTH_KAKAO_CLIENT_SECRET", scope: "api", note: "카카오 콘솔에서 선택 기능이면 빈 값 허용" },
  { key: "KAKAO_HTTP_TIMEOUT_MS", scope: "api", note: "기본 5000(RES-130)" },
  { key: "ADMIN_SEED_EMAIL", scope: "api", note: "미설정 시 development만 기본 어드민 시드, 프로덕션은 시드 스킵" },
  { key: "ADMIN_SEED_PASSWORD", scope: "api", note: "위와 동일 — 둘 다 있어야 프로덕션 어드민 시드" },
  { key: "WORKER_INTERVAL_MS", scope: "api", note: "기본 60000" },
  { key: "WORKER_TOKEN_RETENTION_DAYS", scope: "api", note: "기본 30" },
  { key: "WORKER_JOB_FAILURE_THRESHOLD", scope: "api", note: "기본 3(OPS-130)" },
  { key: "PURGE_RETENTION_DAYS", scope: "api", note: "기본 30(PRIV-105)" },
  { key: "PURGE_BATCH_SIZE", scope: "api", note: "기본 200" },
  { key: "ANALYTICS_EVENTS_RETENTION_DAYS", scope: "api", note: "기본 400(SEC-130)" },
  { key: "AFFILIATE_CLICKS_RETENTION_DAYS", scope: "api", note: "기본 400(SEC-130)" },
  { key: "AUDIT_LOGS_RETENTION_DAYS", scope: "api", note: "기본 730(GAP-058 #10)" },
  { key: "IMPORT_ROWS_RETENTION_DAYS", scope: "api", note: "기본 90(GAP-060 #5, 검수용 가져오기 행)" },
  {
    key: "ADMIN_SESSIONS_RETENTION_DAYS",
    scope: "api",
    // 미설정이 정상: 기본값 30일이 코드에 문서화돼 있고(admin-session-cleanup.job.ts),
    // 로그인 이력은 감사 로그(730일)가 따로 보존하므로 세션 행 삭제로 추적을 잃지 않는다.
    note: "기본 30(라운드 61 #7, 만료·폐기된 어드민 세션 행 — 로그인 이력은 감사 로그가 보존)"
  },
  { key: "PUSH_ENABLED", scope: "api", note: "opt-in — 꺼짐이 정상, 부팅 시 1회 안내 로그" },
  { key: "FCM_SERVICE_ACCOUNT_PATH", scope: "api", note: "PUSH_ENABLED=1일 때만 필요(파일 경로, 내용 아님)" },
  { key: "FCM_TOKEN_HTTP_TIMEOUT_MS", scope: "api", note: "기본 5000(RES-130)" },
  { key: "FCM_SEND_HTTP_TIMEOUT_MS", scope: "api", note: "기본 10000(RES-130)" },
  { key: "LINK_HEALTH_ENABLED", scope: "api", note: "opt-in 외부 네트워크 잡 — 꺼짐이 정상(COM-105)" },
  { key: "LINK_HEALTH_INTERVAL_HOURS", scope: "api", note: "기본 24" },
  { key: "LINK_HEALTH_BATCH", scope: "api", note: "기본 10" },
  { key: "RATE_LIMIT_WINDOW_MS", scope: "api", note: "기본 60000 — 미설정이 정상(테스트 격리용 오버라이드)" },
  { key: "RATE_LIMIT_GLOBAL_MAX", scope: "api", note: "기본 300/분" },
  { key: "RATE_LIMIT_AUTH_MAX", scope: "api", note: "인증 엔드포인트 분당 상한 기본값" },
  { key: "RATE_LIMIT_REDIRECT_MAX", scope: "api", note: "제휴 리다이렉트 분당 상한 기본값" },
  { key: "RATE_LIMIT_ANALYTICS_MAX", scope: "api", note: "기본 60(SEC-132)" },
  { key: "RATE_LIMIT_ANALYTICS_USER_MAX", scope: "api", note: "기본 60(SEC-132, 계정 단위)" },
  { key: "EXPO_PUBLIC_KAKAO_ENABLED", scope: "mobile", note: "0이면 dev 스텁 로그인 — 실 플로우는 셋 다 필요(AUTH-102)" },
  { key: "EXPO_PUBLIC_KAKAO_CLIENT_ID", scope: "mobile", note: "EXPO_PUBLIC_KAKAO_ENABLED=1일 때만 필요" },
  { key: "EXPO_PUBLIC_KAKAO_REDIRECT_URI", scope: "mobile", note: "카카오 콘솔·OAUTH_KAKAO_REDIRECT_URIS 양쪽에 등록" },
  { key: "EXPO_PUBLIC_PUSH_ENABLED", scope: "mobile", note: "opt-in — 꺼짐이 정상(PUSH-113)" },
  { key: "NEXT_PUBLIC_API_BASE_URL", scope: "admin", note: "기본 /api/v1 (same-origin rewrite) — 교차 출처 호출 때만 설정" },
  { key: "ADMIN_API_PROXY_TARGET", scope: "admin", note: "기본 http://localhost:3000 (next.config.js rewrite 대상)" }
];

// 빌드 프로파일·테스트 하네스만 주입하는 키. 코드가 읽지만 `.env`/.env.example의 관심사가
// 아니므로 카탈로그에서 의도적으로 제외한다(드리프트 가드가 "누락"으로 오탐하지 않도록 명시).
const INTENTIONALLY_UNCATALOGUED = [
  "EXPO_PUBLIC_TEST_LOGIN", // scripts/build-android-apk.ts standalone 프로파일
  "EXPO_PUBLIC_PIXEL_LOCK", // 픽셀락 캡처 빌드
  "WOORIAI_STAGE_TODAY", // 시기 계산 테스트 고정 날짜
  "BUILD_PROFILE" // eas 프로파일 분기
] as const;

const catalogueKeys = [...REQUIRED_SPECS, ...OPTIONAL_SPECS].map((spec) => spec.key);

type EnvSource = Record<string, string | undefined>;

function parseEnvLines(content: string): { entries: EnvSource; order: string[]; duplicates: string[] } {
  const entries: EnvSource = {};
  const order: string[] = [];
  const duplicates: string[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (order.includes(key)) {
      duplicates.push(key);
    } else {
      order.push(key);
    }

    entries[key] = value;
  }

  return { entries, order, duplicates };
}

function parseEnvFile(path: string) {
  const resolved = resolve(path);

  if (!existsSync(resolved)) {
    console.error(`[env] File not found: ${resolved}`);
    process.exit(1);
  }

  return parseEnvLines(readFileSync(resolved, "utf8"));
}

const args = process.argv.slice(2);
const fileFlagIndex = args.indexOf("--file");
const parsedFile = fileFlagIndex === -1 ? null : parseEnvFile(args[fileFlagIndex + 1] ?? "");
const envSource: EnvSource = parsedFile ? parsedFile.entries : process.env;
const allowPlaceholders = args.includes("--allow-placeholders");
const scopeFlag = args.find((arg) => arg.startsWith("--scope="))?.slice("--scope=".length);
const scopes = scopeFlag ? scopeFlag.split(",").map((scope) => scope.trim()) : null;

if (scopes) {
  const unknown = scopes.filter((scope) => !["api", "mobile", "admin", "infra"].includes(scope));

  if (unknown.length > 0) {
    console.error(`[env] Unknown --scope value(s): ${unknown.join(", ")} (api|mobile|admin|infra)`);
    process.exit(1);
  }
}

const inScope = (spec: EnvSpec) => !scopes || scopes.includes(spec.scope);
const checkedRequired = REQUIRED_SPECS.filter(inScope);

const errors: string[] = [];

/* ---------------------------------------------------------------------------
 * 1) 필수 키 존재 + 플레이스홀더 검사 (라운드 58 이전 동작 그대로)
 * ------------------------------------------------------------------------- */
const missing = checkedRequired.filter((spec) => !envSource[spec.key]?.trim());
const placeholderSpecs = allowPlaceholders
  ? []
  : checkedRequired.filter((spec) => /change-me|dev-.*client-id/.test(envSource[spec.key] ?? ""));

if (missing.length > 0) {
  errors.push(
    [
      `[env] Missing required environment variables: ${missing.map((spec) => spec.key).join(", ")}`,
      ...missing.map((spec) => `        - ${spec.key} (${spec.scope}): ${spec.note}`)
    ].join("\n")
  );
}

if (placeholderSpecs.length > 0) {
  errors.push(`[env] Replace placeholder values for: ${placeholderSpecs.map((spec) => spec.key).join(", ")}`);
}

/* ---------------------------------------------------------------------------
 * 2) `.env.example` 양방향 드리프트 가드
 *    카탈로그에만 있는 키(예시 파일에 안 적힌 새 키)와, 예시 파일에만 있는 키(코드에서
 *    사라졌거나 카탈로그 등록을 잊은 키)를 둘 다 잡는다. 예시 파일이 없는 배포 컨테이너에서는
 *    건너뛰되 그 사실을 출력한다(조용한 스킵 금지).
 * ------------------------------------------------------------------------- */
const examplePath = resolve(process.cwd(), ".env.example");
let driftChecked = false;

if (existsSync(examplePath)) {
  driftChecked = true;
  const example = parseEnvLines(readFileSync(examplePath, "utf8"));
  const exampleKeys = example.order;

  const missingFromExample = catalogueKeys.filter((key) => !exampleKeys.includes(key));
  const missingFromCatalogue = exampleKeys.filter((key) => !catalogueKeys.includes(key));
  const duplicated = [...new Set(example.duplicates)];

  if (missingFromExample.length > 0) {
    errors.push(
      `[env] .env.example drift — 카탈로그에 있으나 .env.example에 없는 키: ${missingFromExample.join(", ")}\n` +
        "        → .env.example에 값과 주석을 추가하세요."
    );
  }

  if (missingFromCatalogue.length > 0) {
    const buildOnly = missingFromCatalogue.filter((key) =>
      (INTENTIONALLY_UNCATALOGUED as readonly string[]).includes(key)
    );
    errors.push(
      [
        `[env] .env.example drift — .env.example에 있으나 카탈로그에 없는 키: ${missingFromCatalogue.join(", ")}`,
        "        → scripts/check-env.ts의 REQUIRED_SPECS/OPTIONAL_SPECS에 등록하거나 .env.example에서 제거하세요.",
        ...(buildOnly.length > 0
          ? [`        (${buildOnly.join(", ")}는 빌드 프로파일/테스트 전용 키 — .env.example에서 제거가 정답입니다)`]
          : [])
      ].join("\n")
    );
  }

  if (duplicated.length > 0) {
    errors.push(`[env] .env.example에 중복 정의된 키: ${duplicated.join(", ")} (뒤에 온 값이 이깁니다)`);
  }
} else {
  console.warn(`[env] .env.example not found at ${examplePath} — drift guard skipped.`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }

  process.exit(1);
}

const sourceName = fileFlagIndex === -1 ? "process.env" : args[fileFlagIndex + 1];
const scopeLabel = scopes ? ` [scope: ${scopes.join(",")}]` : "";
console.log(
  `[env] ${checkedRequired.length} required variables present in ${sourceName}${scopeLabel}; ` +
    `${OPTIONAL_SPECS.filter(inScope).length} optional keys catalogued; ` +
    `.env.example drift guard ${driftChecked ? `OK (${catalogueKeys.length} keys)` : "skipped"}.`
);
