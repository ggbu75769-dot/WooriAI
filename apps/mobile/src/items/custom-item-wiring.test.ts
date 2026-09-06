import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeEssentialPrepProgress } from "./prep-progress";
import { filterInterestedItems, filterItems } from "./item-filters";
import { itemMatchesBand } from "./stage-bands";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
const itemsSource = () => source("app/(tabs)/items.tsx");
const detailSource = () => source("app/items/[itemTemplateId].tsx");
const sheetSource = () => source("src/items/CustomItemSheet.tsx");

/**
 * 라운드 100 T3 — **커스텀 품목 UI 배선 계약**
 * (설계 문서 docs/5차/round100-custom-items-design.md §4 · §6.3 · §6.6).
 *
 * 판정·문구는 순수 모듈(./custom-item-form.ts — 옆 테스트가 지킨다)에 있고, 여기서 보는 것은
 * 그 모듈·시트가 실제로 화면에 **연결돼 있는가**와, 잠긴 표면(픽셀락 비세션 렌더 · 타일 구성 ·
 * status 아웃박스 경로 · DNC-010 인접 구간)이 **0바이트 무접촉인가**다
 * (item-expense-roundtrip-wiring.test.ts와 같은 소스 그렙 관례).
 *
 * ⚠️ 자르는 구간은 전부 실재 확인을 먼저 지난다(라운드 78 규칙 — 시작 표식이 -1이면 빈 구간
 * 위에서 부정 단언이 영원히 초록이다).
 */
describe("§4.1 진입점 — PreparationListParity 아래 · 세션 전용(ITEM-001 구조 불변)", () => {
  it("진입 버튼·시트가 비세션 프리뷰 반환 **뒤**의 세션 렌더에만 선다", () => {
    const items = itemsSource();
    const previewReturn = items.indexOf("if (!hasSession) {");
    const parityRender = items.indexOf("<PreparationListParity");
    const entryButton = items.indexOf("label={customItemEntryLabel()}");
    const sheetRender = items.indexOf("<CustomItemSheet");
    expect(previewReturn, "비세션 프리뷰 갈래").toBeGreaterThan(-1);
    expect(parityRender, "목록 프레임 렌더").toBeGreaterThan(previewReturn);
    // 문서 §4.1: 목록을 끝까지 훑고 "없네"가 되는 지점 — 프레임 **아래**, 같은 스크롤 안이다.
    expect(entryButton, "진입 버튼").toBeGreaterThan(parityRender);
    expect(sheetRender, "입력 시트").toBeGreaterThan(entryButton);
  });

  it("진입 문구는 순수 모듈에서만 온다(화면 인라인 리터럴 0건)", () => {
    const items = itemsSource();
    expect(items).toContain('from "../../src/items/custom-item-form"');
    expect(items).toContain('from "../../src/items/CustomItemSheet"');
    expect(items).not.toContain('label="준비물 직접 추가하기"');
  });

  it("보기 전용 게이트가 시트보다 먼저다(준비 상태 변경과 같은 판정 — §2.6)", () => {
    const items = itemsSource();
    const entryButton = items.indexOf("label={customItemEntryLabel()}");
    const sheetOpen = items.indexOf("setShowCustomItemSheet(true);");
    expect(entryButton, "진입 버튼").toBeGreaterThan(-1);
    expect(sheetOpen, "시트 열기").toBeGreaterThan(entryButton);
    const pressHandler = items.slice(entryButton, sheetOpen);
    expect(pressHandler).toContain("itemStatusGate.locked");
    expect(pressHandler).toContain("itemStatusGate.explain();");
  });

  it("아이 전환이 열려 있던 시트를 걷는다(라운드 99 F2 L-3 관례) · 성공 토스트는 공용 수명 훅이다", () => {
    const items = itemsSource();
    const resetEffect = items.indexOf("setHasManualStageSelection(false);");
    const resetEffectEnd = items.indexOf("}, [childId]);", resetEffect);
    expect(resetEffect, "아이 전환 리셋 effect").toBeGreaterThan(-1);
    expect(resetEffectEnd, "리셋 effect의 끝").toBeGreaterThan(resetEffect);
    expect(items.slice(resetEffect, resetEffectEnd)).toContain("setShowCustomItemSheet(false);");
    expect(items).toContain("useTransientNotice()");
    expect(items).toContain("showCustomItemNotice(customItemCreatedNotice(saved.name));");
  });
});

describe("§4.2 입력 시트 — 뮤테이션·멱등·실패 얼굴(스윕 §6.3 준수)", () => {
  it("신규 뮤테이션 전부 pending disabled다(mutation-press-guard control-blocks)", () => {
    const sheet = sheetSource();
    expect(sheet).toContain("disabled={save.isPending}");
    expect(sheet).toContain("disabled={remove.isPending}");
    // R100-R ④ 삭제/수정 상호 배제: 수정 시트가 서 있는 동안(수정 save 왕복 포함 — save는
    // 시트 안에 살아 pending이 시트 mount 수명의 부분집합이다) 삭제 입구도 함께 잠긴다.
    expect(sheet).toContain("disabled={remove.isPending || isEditSheetOpen}");
  });

  it("생성은 초안 단위 멱등 키(본문 지문 묶음)를 재사용하고 성공 시 폐기한다(§2.3)", () => {
    const sheet = sheetSource();
    expect(sheet).toContain("getOrCreateCustomItemKey(keyHolder, customItemBodyFingerprint(body))");
    expect(sheet).toContain("rotateCustomItemKey(keyHolder);");
  });

  it('저장 성공은 ["items", childId] 무효화 한 번 + 시트 닫힘이다(§4.2)', () => {
    const sheet = sheetSource();
    expect(sheet).toContain('await queryClient.invalidateQueries({ queryKey: ["items", childId] });');
    // 수정이면 열려 있는 상세 캐시도 함께 갈아 끼운다.
    expect(sheet).toContain('await queryClient.invalidateQueries({ queryKey: ["item-detail", childId, mode.customItemId] });');
    // 닫힘·토스트는 호출부 몫(onSaved) — 시트는 성공을 알리기만 한다.
    expect(sheet).toContain("onSaved(saved);");
  });

  it("실패 얼굴: 표 코드는 useSaveErrorCopy가, 커스텀 두 코드·로컬 문장은 모듈이 진다(§9.3)", () => {
    const sheet = sheetSource();
    expect(sheet).toContain("useSaveErrorCopy(save.isError, save.error)");
    expect(sheet).toContain("customItemMutationErrorMessage(save.error, saveErrorFallback)");
    expect(sheet).toContain("useSaveErrorCopy(remove.isError, remove.error)");
    // 실패는 스스로 낭독하는 Toast 한 자리다(A11Y-115).
    expect(sheet).toContain('<Toast message={failureText} tone="error" />');
  });

  it("이름 가드: 상한은 모듈 값 하나 + 저장 직전 들어 있는 값까지 판정(text-limits 관례)", () => {
    const sheet = sheetSource();
    expect(sheet).toContain("maxLength={customItemNameMaxLength()}");
    expect(sheet).toContain("validateCustomItemName(draft.name)");
    expect(sheet).toContain("normalizeCustomItemName(draft.name)");
  });

  it("keyboard-tap-guard: 시트 파일에 안쪽 스크롤러 여는 태그가 0건이다(바깥 handled 스크롤러만 쓴다)", () => {
    const sheet = sheetSource();
    // 입력칸이 있는 파일에 기본값 스크롤러가 서면 첫 탭이 먹힌다 — 안쪽 스크롤러 자체를 만들지
    // 않는 것이 가장 확실한 준수다(AppScreen이 keyboardShouldPersistTaps="handled"를 선언한다).
    expect(sheet).toContain("<TextInput");
    expect(sheet).not.toContain("<ScrollView");
    expect(sheet).not.toContain("<FlatList");
    expect(sheet).not.toContain("<SectionList");
  });

  it("status는 시트가 보내지 않는다 — 상태 변경은 기존 status 경로 하나뿐이다(§2.4·§9.1)", () => {
    const sheet = sheetSource();
    expect(sheet).not.toContain("updateItemStatus");
    expect(sheet).not.toContain("updateItemStatusOffline");
  });
});

describe("§4.3 목록 합류 — 표식은 발밑 슬롯, 잠긴 타일·상류 목록 0바이트", () => {
  it("커스텀 표식은 renderItemFooter 슬롯에서 isCustom 행에만 선다", () => {
    const items = itemsSource();
    const footerStart = items.indexOf("renderItemFooter={(parityItem) => {");
    const footerEnd = items.indexOf("label={customItemEntryLabel()}");
    expect(footerStart, "발밑 슬롯").toBeGreaterThan(-1);
    expect(footerEnd, "슬롯 뒤 진입 버튼").toBeGreaterThan(footerStart);
    const footer = items.slice(footerStart, footerEnd);
    expect(footer).toContain("{item.isCustom ? (");
    expect(footer).toContain("{customItemListMarkerText()}");
  });

  it("타일 뼈대(PreparationListParity·catalog-contract)는 0바이트 무접촉이다 — 읽기 전용 계약", () => {
    // 승인 디자인 잠금(§4.3): 표식은 타일이 아니라 슬롯이다. 두 파일에 isCustom 갈래가 생기면
    // 잠긴 뼈대가 커스텀을 알게 된 것이고, 그것은 이 트랙의 소유 밖 결정이다.
    expect(source("src/preparation/PreparationListParity.tsx")).not.toContain("isCustom");
    expect(source("src/preparation/catalog-contract.ts")).not.toContain("isCustom");
  });

  it("준비율·축하·찜 상류(effectiveStatusItems 계열)에 커스텀 분기가 0건이다 — 자연 합류(라운드 99 F2)", () => {
    const items = itemsSource();
    const upstreamStart = items.indexOf("const effectiveStatusItems");
    const upstreamEnd = items.indexOf("const categoryNameOf = ");
    expect(upstreamStart, "보정 목록 선언").toBeGreaterThan(-1);
    expect(upstreamEnd, "상류 구간의 끝").toBeGreaterThan(upstreamStart);
    expect(items.slice(upstreamStart, upstreamEnd)).not.toContain("isCustom");
    // 준비율·찜의 입력이 그 보정 목록이라는 기존 배선은 그대로다(핀 인용).
    expect(items).toContain("computeEssentialPrepProgress(effectiveStatusItems, stageLabel)");
    expect(items).toContain("filterInterestedItems(effectiveStatusItems)");
  });

  it("자연 합류를 값으로도 확인한다 — 커스텀 행이 준비율 분모·찜·필터에 그대로 선다", () => {
    type NaturalJoinRow = {
      id: string;
      name: string;
      necessityLevel: "essential" | "convenience" | "optional";
      status: "not_prepared" | "prepared" | "gifted" | "not_needed" | "interested";
      stageCodes: Array<"toddler_1_3">;
      isCustom?: boolean;
    };
    const catalogRow: NaturalJoinRow = {
      id: "tmpl-1",
      name: "카시트",
      necessityLevel: "essential",
      status: "prepared",
      stageCodes: ["toddler_1_3"]
    };
    const customRow: NaturalJoinRow = {
      id: "custom-1",
      name: "아기 욕조",
      necessityLevel: "essential",
      status: "not_prepared",
      stageCodes: ["toddler_1_3"],
      isCustom: true
    };
    // 준비율(ITEM-114): essential 커스텀이 분모에 선다 — §6.2의 의도된 합류.
    const progress = computeEssentialPrepProgress([catalogRow, customRow], "12-24개월");
    expect(progress).not.toBeNull();
    expect(progress!.totalCount).toBe(2);
    expect(progress!.resolvedCount).toBe(1);
    // 찜 필터: status 하나로 판정하므로 커스텀도 같은 규칙이다.
    expect(filterInterestedItems([{ ...customRow, status: "interested" }, catalogRow])).toHaveLength(1);
    // 필수도·검색 필터: ItemSummary 필드만 읽으므로 커스텀이 자동 적용된다.
    expect(filterItems([catalogRow, customRow], { necessity: "essential", searchText: "욕조" })).toEqual([customRow]);
    // 시기 버킷 판정 입력(stageCodes 전개)도 같은 술어를 지난다(§1.3 — 24개월+ 중복은 카탈로그와 동일).
    expect(itemMatchesBand(customRow, "12-24개월")).toBe(true);
    expect(itemMatchesBand(customRow, "6-12개월")).toBe(false);
  });

  it("프리필 게이트: 커스텀이면 itemTemplateId 키를 걷고, 조립기는 한 벌 그대로다(§4.3)", () => {
    const items = itemsSource();
    expect(items).toContain("withoutCustomItemTemplateId(");
    expect(items).toContain("isCustomItemInList(items.data?.items, prompt.itemTemplateId)");
    // 조립기 자체(expense-link-prompt.ts)는 0바이트 — 걷는 함수가 조립하지 않는다.
    expect(source("src/items/expense-link-prompt.ts")).not.toContain("isCustom");
  });
});

describe("§2.4 status 편승 — 화면 코드 분기 불요(아웃박스·게이트 그대로)", () => {
  it("목록의 상태 변경 경로(applyStatusChange → 아웃박스)에 커스텀 분기가 0건이다", () => {
    const items = itemsSource();
    const pathStart = items.indexOf("const applyStatusChange = (variables: {");
    const pathEnd = items.indexOf("const hasSession = Boolean(authToken && childId);");
    expect(pathStart, "목록 상태 변경 경로").toBeGreaterThan(-1);
    expect(pathEnd, "경로의 끝").toBeGreaterThan(pathStart);
    const path = items.slice(pathStart, pathEnd);
    expect(path).toContain("updateItemStatusOffline(authToken, queryClient, {");
    expect(path).not.toContain("isCustom");
  });

  it("상세의 상태 변경 경로(찜·선물·준비 완료)에도 커스텀 분기가 0건이다", () => {
    const detail = detailSource();
    const pathStart = detail.indexOf("const applyStatusChange = (status: ItemStatus");
    const pathEnd = detail.indexOf("const registerPurchaseFollowup = ");
    expect(pathStart, "상세 상태 변경 경로").toBeGreaterThan(-1);
    expect(pathEnd, "경로의 끝").toBeGreaterThan(pathStart);
    expect(detail.slice(pathStart, pathEnd)).not.toContain("isCustom");
  });
});

describe("§4.4 상세 갈래 — 수정/삭제 진입 · 기존 0건 갈래가 접는 표면(§5)", () => {
  it("커스텀이면 세션 갈래에서 CustomItemDetailActions가 선다(비세션 캡처 무접촉)", () => {
    const detail = detailSource();
    const visibleDecl = detail.indexOf("const visibleDetail = hasSession ? detail.data! : previewDetail(itemTemplateId);");
    const actions = detail.indexOf("<CustomItemDetailActions");
    expect(visibleDecl, "세션/프리뷰 갈림").toBeGreaterThan(-1);
    expect(actions, "커스텀 갈래").toBeGreaterThan(visibleDecl);
    expect(detail).toContain("{hasSession && visibleDetail.isCustom === true ? (");
  });

  it("수정은 시트 재사용·삭제는 확인 Alert(조사 판정) → 목록 복귀 + 무효화다", () => {
    const sheet = sheetSource();
    expect(sheet).toContain('mode={{\n            kind: "edit",');
    expect(sheet).toContain("customItemDeleteConfirmCopy(item.name)");
    expect(sheet).toContain("Alert.alert(confirmCopy.title, confirmCopy.message, [");
    const removeStart = sheet.indexOf("const remove = useMutation({");
    const removeEnd = sheet.indexOf("const removeErrorFallback");
    expect(removeStart, "삭제 뮤테이션").toBeGreaterThan(-1);
    expect(removeEnd, "삭제 뮤테이션 구간의 끝").toBeGreaterThan(removeStart);
    const removeSlice = sheet.slice(removeStart, removeEnd);
    expect(removeSlice).toContain("router.back();");
    expect(removeSlice).toContain('await queryClient.invalidateQueries({ queryKey: ["items", childId] });');
  });

  it("수정/삭제 게이트는 확인·시트보다 먼저다(useItemStatusGate 재사용 — 라운드 99 F2 L-1 순서)", () => {
    const sheet = sheetSource();
    const editPress = sheet.indexOf("const handleEditPress = () => {");
    const deletePress = sheet.indexOf("const handleDeletePress = () => {");
    expect(editPress, "수정 진입 핸들러").toBeGreaterThan(-1);
    expect(deletePress, "삭제 진입 핸들러").toBeGreaterThan(editPress);
    const editBody = sheet.slice(editPress, deletePress);
    expect(editBody).toContain("itemStatusGate.locked");
    // R100-R ⑤ (라운드 78 규칙): 끝 표식도 실재 확인을 지난다 — Alert.alert 호출이 사라지면
    // slice(deletePress, -1)이 핸들러 뒤 전체를 삼켜 부정/긍정 단언이 엉뚱한 구간 위에 선다.
    const deleteAlertCall = sheet.indexOf("Alert.alert(", deletePress);
    expect(deleteAlertCall, "삭제 확인 Alert 호출").toBeGreaterThan(deletePress);
    const deleteBody = sheet.slice(deletePress, deleteAlertCall);
    expect(deleteBody).toContain("itemStatusGate.locked");
  });

  it("링크·고지·가격·구매 후속 표면은 기존 0건 갈래가 접는다 — 신규 조건부 은닉 0건(§5·DNC-010/011)", () => {
    const detail = detailSource();
    // 판정 셋은 종전 그대로다(링크 0건 갈래 — 라운드 43 C2·M-1의 그 배선).
    expect(detail).toContain("const hasProductLinks = hasPurchasable");
    expect(detail).toContain("const affiliateDisclosureText = productLinksDisclosureText(visibleDetail.productLinks);");
    expect(detail).toContain("{affiliateDisclosureText ? <AffiliateDisclosure text={affiliateDisclosureText} /> : null}");
    // 고지 판정 선언부터 구매 CTA까지 — DNC-010 인접 표면에 커스텀 갈래가 끼지 않는다.
    const disclosureDecl = detail.indexOf("const affiliateDisclosureText = ");
    const disclosureRender = detail.indexOf("{affiliateDisclosureText ? <AffiliateDisclosure");
    const purchaseCta = detail.indexOf('label="바로 구매하기"');
    expect(disclosureDecl, "고지 판정 선언").toBeGreaterThan(-1);
    expect(disclosureRender, "고지 렌더").toBeGreaterThan(disclosureDecl);
    expect(purchaseCta, "구매 CTA").toBeGreaterThan(disclosureRender);
    expect(detail.slice(disclosureRender, purchaseCta)).not.toContain("isCustom");
  });

  it("상세 화면 자신은 새 문장·새 뮤테이션을 들지 않는다(연타 계약의 두 핀이 구조적으로 불변)", () => {
    const detail = detailSource();
    // 이 화면의 isCustom 소비는 정확히 셋뿐이다 — 갈래 렌더 하나 + 프리필 게이트 둘.
    expect(detail.split("visibleDetail.isCustom === true").length - 1).toBe(3);
    // 프리필 두 진입점 모두 같은 걷기 한 겹을 지난다(조립기 P2-5 규율의 커스텀 판).
    expect(detail.split("withoutCustomItemTemplateId(").length - 1).toBe(2);
  });
});
