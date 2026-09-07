import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { productLinkSeedKey, productLinkSeeds } from "../prisma/seed-data";
import { isDatabaseAvailable } from "./helpers/test-db";

/**
 * 라운드 107 트랙 E — **시드 경계의 대장**(정찰 S5 D3).
 *
 * 무엇을 잠그는가. 배포 스크립트는 매 배포마다 시드를 돌린다
 * (`scripts/deploy/oracle-bootstrap.sh` 8단계). 그 시드가 종전에는 콘텐츠 다섯 표를
 * 전량 덮어써서 어드민 편집분을 되돌렸고, `product_links`는 자연키에 어드민 편집 축인
 * `title`이 들어 있어 **되돌림이 아니라 증식**이었다(제목을 고치면 다음 배포가 살아 있는
 * 구매 CTA를 하나 더 만든다 — 핵심 루프의 마지막 마디가 둘로 갈라진다).
 *
 * 이 파일이 묻는 것은 하나다: **시드를 두 번 더 돌려도 어드민 편집분이 살아남고 링크가
 * 늘지 않는가.** 실제 `pnpm --filter api seed`(= `tsx prisma/seed.ts`)를 하위 프로세스로
 * 돌려서 묻는다 — 시드 로직의 사본을 테스트가 다시 쓰면 배포가 실제로 도는 그 코드가
 * 아니라 사본을 재는 것이 되기 때문이다.
 *
 * **왜 전용 스키마인가.** 이 스위트는 시드 행(카테고리·준비템·고지·링크)을 편집해야
 * 하는데, 공유 test DB의 그 행들은 다른 스위트가 함께 읽는다(`categories.e2e`는 시드
 * 21행을 정확히 고정하고, `product-link-price-honesty`는 시드 링크를 제목으로 찾는다).
 * 그래서 같은 DB 안에 **자기 스키마**를 세우고 거기에 마이그레이션 25개를 적용한 뒤
 * 그 안에서만 편집한다 — 다른 워커의 행을 한 줄도 건드리지 않는다(별도 DATABASE는
 * CREATE DATABASE 권한이 필요해 환경마다 갈리므로 쓰지 않는다). 끝나면 스키마째 버린다.
 *
 * 비용 실측(로컬, PostgreSQL 16): migrate deploy 약 1.9s + 시드 1회 약 1.5s.
 */
const apiRoot = fileURLToPath(new URL("..", import.meta.url));

/** 이 스위트 전용 스키마 이름 — 같은 DB의 다른 워커와 절대 겹치지 않게 난수를 붙인다. */
const SCHEMA = `seed_boundary_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;

function schemaUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("schema", SCHEMA);
  return url.toString();
}

function binPath(name: string, roots: string[]): string {
  const fileName = process.platform === "win32" ? `${name}.CMD` : name;
  const found = roots.map((root) => join(root, "node_modules", ".bin", fileName)).find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`${name} 실행 파일을 찾을 수 없어요.`);
  }
  return found;
}

const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("시드 경계 — 재시드가 어드민 편집분을 덮지 않는다 (라운드 107 E / 정찰 S5 D3)", () => {
  let prisma: PrismaClient;
  let url: string;

  /**
   * 배포가 도는 그 명령 그대로. 요약은 stdout, 경고(중복 보고)는 stderr로 나가므로
   * **둘 다** 합쳐 돌려준다 — 한쪽만 보면 경고를 못 보고도 초록일 수 있다.
   */
  function runSeed(extraEnv: Record<string, string> = {}): string {
    const tsxBin = binPath("tsx", [apiRoot, join(apiRoot, "..", "..")]);
    const result = spawnSync(tsxBin, ["prisma/seed.ts"], {
      cwd: apiRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: url,
        NODE_ENV: "test",
        // 부모 프로세스가 켜 두었더라도 기본 경로를 재는 것이 이 스위트의 목적이다.
        SEED_OVERWRITE_CONTENT: "",
        ...extraEnv
      }
    });
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    if (result.status !== 0) {
      throw new Error(`시드 실행이 실패했어요(exit ${result.status}):\n${output}`);
    }
    return output;
  }

  beforeAll(async () => {
    const baseUrl = process.env.DATABASE_URL;
    expect(baseUrl, "DATABASE_URL이 필요해요").toBeTruthy();
    url = schemaUrl(baseUrl as string);

    const prismaBin = binPath("prisma", [apiRoot]);
    execSync(`"${prismaBin}" migrate deploy --schema prisma/schema.prisma`, {
      cwd: apiRoot,
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: url }
    });
    runSeed();

    prisma = new PrismaClient({ datasourceUrl: url });
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    if (!dbAvailable) return;
    const cleaner = new PrismaClient();
    try {
      await cleaner.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    } finally {
      await cleaner.$disconnect();
    }
  }, 60_000);

  it("시드 링크의 안정 키는 (준비템 코드, 플랫폼) 쌍이고 그 쌍은 시드 안에서 유일하다", () => {
    // 이 유일성이 깨지면 부분 유니크 색인(uq_product_links_seed_key)이 시드를 멈춘다.
    // 그 전에 여기서 이름으로 말한다. CSV 일괄 교체 도구도 같은 쌍에 "정확히 1건"을
    // 요구하므로, 이 대장은 그 도구의 전제와 같은 값을 지킨다.
    const keys = productLinkSeeds.map((link) => productLinkSeedKey(link));
    expect(new Set(keys).size, `시드 키가 겹쳤어요: ${keys.length}건 중 ${new Set(keys).size}개만 유일`).toBe(keys.length);
    for (const link of productLinkSeeds) {
      expect(productLinkSeedKey(link)).toBe(`${link.itemTemplateCode}:${link.platform}`);
    }
  });

  it("첫 시드가 모든 시드 링크에 안정 키를 남긴다 (자연키였던 title을 더는 쓰지 않는다)", async () => {
    const links = await prisma.productLink.findMany({ select: { seedKey: true } });
    expect(links).toHaveLength(productLinkSeeds.length);
    expect(links.every((link) => link.seedKey !== null)).toBe(true);
  });

  it("어드민 편집분이 재시드 두 번을 살아남고 구매 링크가 늘지 않는다", async () => {
    const template = await prisma.itemTemplate.findUniqueOrThrow({ where: { code: "car_seat" } });
    const seededLink = await prisma.productLink.findFirstOrThrow({ where: { seedKey: "car_seat:coupang" } });
    const beforeLinkCount = await prisma.productLink.count();

    // ── 운영자가 어드민에서 하는 편집을 다섯 표에 한 번씩 재현한다.
    await prisma.productLink.update({
      where: { id: seededLink.id },
      // 제목만 고쳐도 종전 시드는 이 행을 못 알아봤다(정찰 S5 D3 ②). URL까지 함께 고치는
      // 것은 플랜 A 전환(쿠팡 승인 후 CSV 일괄 교체)이 실제로 하는 편집이다.
      data: { title: "카시트 (운영자가 고친 이름)", url: "https://www.coupang.com/np/search?q=operator", active: false }
    });
    await prisma.category.update({
      where: { code: "diaper_hygiene" },
      data: { name: "기저귀/위생(운영자)", displayOrder: 41, selectable: false, active: false }
    });
    await prisma.itemTemplate.update({
      where: { code: "car_seat" },
      data: { name: "카시트(운영자)", displayOrder: 77, active: false }
    });
    await prisma.disclosure.update({
      where: { key: "affiliate_purchase" },
      data: { text: "운영자가 고친 고지 문구예요." }
    });
    // 단계는 어드민이 **집합으로** 바꾼다(replaceItemTemplateStages: delete-all → 재삽입).
    // 운영자가 뺀 단계가 배포마다 되살아나면 안 된다.
    const removedStage = await prisma.itemTemplateStage.findFirstOrThrow({
      where: { itemTemplateId: template.id }
    });
    await prisma.itemTemplateStage.delete({
      where: { itemTemplateId_stageCode: { itemTemplateId: template.id, stageCode: removedStage.stageCode } }
    });

    // ── 배포 두 번.
    runSeed();
    runSeed();

    const link = await prisma.productLink.findUniqueOrThrow({ where: { id: seededLink.id } });
    expect(link.title).toBe("카시트 (운영자가 고친 이름)");
    expect(link.url).toBe("https://www.coupang.com/np/search?q=operator");
    expect(link.active).toBe(false);

    const category = await prisma.category.findUniqueOrThrow({ where: { code: "diaper_hygiene" } });
    expect(category.name).toBe("기저귀/위생(운영자)");
    expect(category.displayOrder).toBe(41);
    expect(category.selectable).toBe(false);
    expect(category.active).toBe(false);

    const item = await prisma.itemTemplate.findUniqueOrThrow({ where: { code: "car_seat" } });
    expect(item.name).toBe("카시트(운영자)");
    expect(item.displayOrder).toBe(77);
    expect(item.active).toBe(false);

    const disclosure = await prisma.disclosure.findUniqueOrThrow({ where: { key: "affiliate_purchase" } });
    expect(disclosure.text).toBe("운영자가 고친 고지 문구예요.");

    const resurrected = await prisma.itemTemplateStage.findUnique({
      where: { itemTemplateId_stageCode: { itemTemplateId: template.id, stageCode: removedStage.stageCode } }
    });
    expect(resurrected, "운영자가 뺀 단계가 재시드에 되살아났어요").toBeNull();

    // ── 그리고 링크는 **하나도 늘지 않았다**(D3 ②의 증식).
    expect(await prisma.productLink.count()).toBe(beforeLinkCount);
    expect(await prisma.productLink.count({ where: { itemTemplateId: template.id, platform: "coupang" } })).toBe(1);

    // 원래 값으로 되돌리는 길은 명시적 opt-in 하나뿐이고, 그 길은 실제로 동작해야 한다
    // (로컬에서 시드 데이터를 고친 뒤 dev/test DB를 맞추는 자리 — 배포 경로는 쓰지 않는다).
    runSeed({ SEED_OVERWRITE_CONTENT: "1" });
    expect((await prisma.category.findUniqueOrThrow({ where: { code: "diaper_hygiene" } })).name).toBe("기저귀/위생");
    expect((await prisma.productLink.findUniqueOrThrow({ where: { id: seededLink.id } })).title).toBe(seededLink.title);
    expect(await prisma.productLink.count()).toBe(beforeLinkCount);
  }, 180_000);

  it("안정 키가 없던 기존 DB(000026 이전)는 입양된다 — 제목·URL이 둘 다 바뀐 뒤에도 늘지 않는다", async () => {
    // 000026 직전 상태를 그대로 만든다: seed_key 전량 NULL + 그 사이 운영자가 고친 이름.
    const target = await prisma.productLink.findFirstOrThrow({ where: { seedKey: "stroller:coupang" } });
    await prisma.productLink.updateMany({ data: { seedKey: null } });
    await prisma.productLink.update({
      where: { id: target.id },
      data: { title: "완전히 다른 이름", url: "https://www.coupang.com/np/search?q=renamed" }
    });
    const before = await prisma.productLink.count();

    const output = runSeed();

    expect(output).toContain(`시드 키 입양 ${before}`);
    expect(await prisma.productLink.count()).toBe(before);
    expect(await prisma.productLink.count({ where: { seedKey: null } })).toBe(0);
    // 입양은 seed_key 한 칸만 쓴다 — 콘텐츠는 운영자가 고친 그대로다.
    const adopted = await prisma.productLink.findUniqueOrThrow({ where: { id: target.id } });
    expect(adopted.title).toBe("완전히 다른 이름");
    expect(adopted.seedKey).not.toBeNull();
  }, 180_000);

  it("이미 중복이 생긴 환경을 지우지 않고 이름으로 보고한다", async () => {
    const keyed = await prisma.productLink.findFirstOrThrow({ where: { seedKey: "car_seat:coupang" } });
    // 종전 시드가 만들던 그 두 번째 행을 손으로 세운다.
    const stray = await prisma.productLink.create({
      data: {
        itemTemplateId: keyed.itemTemplateId,
        platform: keyed.platform,
        title: "옛 example.com 행",
        url: "https://example.com/legacy",
        redirectCode: `dup${Math.random().toString(36).slice(2, 10)}`
      }
    });
    const before = await prisma.productLink.count();

    const output = runSeed();

    expect(output).toContain("product_links 중복: car_seat/coupang");
    // 시드는 아무것도 지우지 않는다 — 어느 행에 클릭 이력이 붙었는지를 봐야 하는 판단이다.
    expect(await prisma.productLink.count()).toBe(before);
    expect(await prisma.productLink.findUnique({ where: { id: stray.id } })).not.toBeNull();

    await prisma.productLink.delete({ where: { id: stray.id } });
  }, 180_000);
});
