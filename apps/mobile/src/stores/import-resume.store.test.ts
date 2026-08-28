import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { ImportResumeEntry } from "../import/import-resume";
import { useImportResumeStore } from "./import-resume.store";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

/**
 * 라운드 56 트랙 D(#5) — 재진입 저장본의 **생멸**.
 *
 * vitest/node에는 AsyncStorage가 없으므로 persist-storage.ts의 인메모리 폴백이 그대로 쓰인다
 * (app-lock.store.test.ts와 같은 이유). 여기서 보는 것은 저장 왕복이 아니라 "언제 적히고 언제
 * 지워지는가"다 -- 그 규칙이 곧 카드의 생멸이기 때문이다.
 */

const entry: ImportResumeEntry = {
  childId: "child-1",
  jobId: "job-1",
  fileName: "5월 카드내역.xlsx",
  createdAt: "2026-08-28T09:00:00.000Z"
};

const state = () => useImportResumeStore.getState();

describe("useImportResumeStore", () => {
  beforeEach(() => {
    state().resetAll();
  });

  it("업로드 성공 1건만 들고 있고, 새 업로드가 이전 것을 덮는다", () => {
    expect(state().entry).toBeNull();
    state().rememberImportReview(entry);
    expect(state().entry).toEqual(entry);

    const next = { ...entry, jobId: "job-2", fileName: "6월 카드내역.csv" };
    state().rememberImportReview(next);
    expect(state().entry).toEqual(next);
  });

  it("모양이 어긋난 값은 저장하지 않는다 (카드가 갈 곳을 잃지 않게)", () => {
    state().rememberImportReview({ ...entry, jobId: "  " });
    expect(state().entry).toBeNull();
    state().rememberImportReview({ ...entry, createdAt: "어제" });
    expect(state().entry).toBeNull();
  });

  it("확정/취소된 잡을 지운다 — 그런데 **자기 잡일 때만** 지운다", () => {
    state().rememberImportReview(entry);
    // 옛 링크로 열려 있던 화면(job-0)의 정리가 뒤늦게 깨어나도 방금 올린 잡의 카드는 남는다.
    state().forgetImportReview("job-0");
    expect(state().entry).toEqual(entry);

    state().forgetImportReview("job-1");
    expect(state().entry).toBeNull();
  });

  it("jobId를 주지 않으면 무조건 지운다 (PRIV-104 초기화와 같은 자리)", () => {
    state().rememberImportReview(entry);
    state().forgetImportReview();
    expect(state().entry).toBeNull();

    state().rememberImportReview(entry);
    state().resetAll();
    expect(state().entry).toBeNull();
  });

  /**
   * 라운드 57 QA(P2-5) — 헤더가 "아직 배선되지 않았다"고 적혀 있었지만 배선은 라운드 55 트랙 C가
   * 이미 넣었다. 문서와 코드가 갈리면 다음 사람이 없는 결함을 고치려 든다(또는 있는 결함으로
   * 착각해 중복 배선한다). 사실 쪽으로 못 박는다.
   */
  it("PRIV-104 배선이 실제로 들어와 있고, 헤더도 그 사실을 말한다", () => {
    const teardownSource = source("src/offline/session-teardown.ts");
    expect(teardownSource).toContain('import { useImportResumeStore } from "../stores/import-resume.store";');
    expect(teardownSource).toContain("useImportResumeStore.getState().resetAll();");

    const storeSource = source("src/stores/import-resume.store.ts");
    // 옛 제목(사실이 아니게 된 주장)과 "자리만 만들어 뒀다"는 문장은 남아 있지 않다.
    expect(storeSource).not.toContain("## PRIV-104(계정 전환 시 초기화) — 아직 배선되지 않았다");
    expect(storeSource).not.toContain("후속 1줄");
    expect(storeSource).not.toContain("호출부는 후속");
    expect(storeSource).toContain("그 배선은 **들어와 있다**");
  });

  it("바뀌지 않으면 같은 상태를 유지한다 (구독자가 헛돌지 않게)", () => {
    const before = useImportResumeStore.getState();
    state().forgetImportReview("job-1");
    expect(useImportResumeStore.getState()).toBe(before);
  });

  it("persist 관례가 저장소의 다른 스토어와 같다 (version + 양쪽 sanitize)", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("./import-resume.store.ts", import.meta.url), "utf8");
    expect(source).toContain('name: "wooriai-import-resume"');
    expect(source).toContain("storage: createJSONStorage(() => persistStorage)");
    expect(source).toContain("version: 1");
    expect(source).toContain("migrate: (persisted) => sanitizedState(persisted)");
    expect(source).toContain("merge: (persisted, current) => ({ ...current, ...sanitizedState(persisted) })");
    // 규칙은 순수 모듈 한 곳에만 있다.
    expect(source).toContain('from "../import/import-resume"');
  });
});
