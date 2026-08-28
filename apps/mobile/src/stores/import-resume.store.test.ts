import { beforeEach, describe, expect, it } from "vitest";
import type { ImportResumeEntry } from "../import/import-resume";
import { useImportResumeStore } from "./import-resume.store";

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
