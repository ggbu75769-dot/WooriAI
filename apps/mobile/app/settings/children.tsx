import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { CHILD_STAGE_CODES, getSeoulToday, type ChildStageCode, type ChildStageMode } from "@wooriai/domain";
import {
  createChild,
  listChildren,
  listHouseholdMembers,
  updateChild,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_SESSION_TOKEN,
  LOCAL_USER_ID,
  type Child
} from "../../src/api/client";
import {
  BORN_TRANSITION_ACTION_LABEL,
  BORN_TRANSITION_CONFIRM_CTA,
  BORN_TRANSITION_CONFIRM_MESSAGE,
  BORN_TRANSITION_CONFIRM_TITLE,
  buildCreateChildBody,
  buildUpdateChildBody,
  canTransitionStageMode,
  childDatePickerDirection,
  CHILD_STAGE_LABELS,
  CHILD_STAGE_MODE_OPTIONS,
  isChildFormValid,
  requiredDateFieldLabel,
  validateChildForm,
  type ChildFormValues
} from "../../src/children/child-form";
import { getOrCreateChildCreateKey, rotateChildCreateKey } from "../../src/children/child-create-idempotency";
import { applyChildSwitch, CHILD_SCOPED_QUERY_KEY_PREFIXES } from "../../src/children/child-switch";
import { ExpenseDatePicker } from "../../src/expenses/ExpenseDatePicker";
import {
  collectKnownHouseholdIds,
  describeHouseholdScope,
  HOUSEHOLD_SCOPE_ADD_CHILD_SWITCH_NOTICE,
  HOUSEHOLD_SCOPE_EMPTY_LABEL,
  HOUSEHOLD_SCOPE_PARAM,
  householdScopeAddChildNotice,
  householdScopePhrase,
  isChildrenSettled,
  parseHouseholdScopeParam,
  resolveManagedHouseholdId
} from "../../src/family/household-scope";
// 라운드 71 트랙 E: 잠긴 세션의 머리말은 게이트와 **같은 판정**을 읽고(새 판정 0건), 문장도
// 화면이 짓지 않는다 — 둘 다 이 순수 모듈의 것이다.
import { isExpenseEntryLocked, VIEW_ONLY_HEADLINES } from "../../src/family/record-permissions";
import { resolveStageDisplayLabel } from "../../src/home/stage-display-label";
import { useSaveErrorCopy } from "../../src/offline/use-load-error-copy";
import { useSelectedChildStore } from "../../src/stores/selected-child.store";
import { useSessionStore } from "../../src/stores/session.store";
import { AppIcon } from "../../src/design-system";
import { theme } from "../../src/theme";
import {
  announceForA11y,
  AppScreen,
  Card,
  CategoryChip,
  EmptyStateCard,
  PrimaryButton,
  ScreenHeader,
  SecondaryButton,
  StatusBadge,
  Toast
} from "../../src/ui";

const emptyForm: ChildFormValues = { nickname: "", dateText: "", manualStage: null };

/**
 * MOB-118 (SET-005 아이 관리): child list with the current selection marked, tap-to-switch
 * (persisted selectedChildId + child-scoped query invalidation), inline edit of
 * 태명/생년월일·예정일/수동 단계 (validation shared with onboarding ONB-002 via
 * src/children/child-form.ts), and 아이 추가 for a second child. Editing/adding is gated to
 * owner/co_parent -- view-only roles (viewer, gift_participant) can only look and switch,
 * matching the server's HouseholdRoleGuard/requireChildAccess(edit) contract.
 *
 * FIX-118B(F2): 아이 추가 carries an Idempotency-Key (src/children/child-create-idempotency.ts),
 * so a lost response cannot turn a user retry into two children -- the same protection onboarding
 * (ONB-002/MOB-101) already had, with a settings-scoped key.
 *
 * FIX-118B(F3): 아이 추가 is hidden entirely in the demo (local-backend) session. The demo backend
 * keeps exactly ONE child record -- localBackend.createChild() *renames* the seeded fixture child
 * and returns LOCAL_CHILD_ID -- so the old flow reported "추가했어요" for something that never
 * happened (a false success). The demo session gets an explicit 안내 instead.
 */

/**
 * CHILD-127: the labeled YYYY-MM-DD input, lifted out of ChildFormFields so the
 * "아이가 태어났어요" 전환 카드 reuses the exact same field (label, a11y label, error styling)
 * instead of growing a second, drifting date input.
 *
 * 라운드 65 D: 그 한 자리에 **달력 버튼**이 붙는다. 이 컴포넌트가 세 곳(편집 폼 · 추가 폼 ·
 * 출생 전환 카드)의 유일한 날짜 칸이므로, 달력도 여기 한 번만 배선하면 세 곳이 같은 문법을
 * 갖는다. 손타이핑 칸은 그대로 남는다 — 달력은 대안이지 대체가 아니다.
 */
function ChildDateField({
  dateLabel,
  direction,
  value,
  error,
  showErrors,
  onChange
}: {
  dateLabel: string;
  /** 달력이 열리는 쪽 — 출산 예정일만 "future"다(src/children/child-form.ts). */
  direction: "past" | "future";
  value: string;
  error: string | null;
  showErrors: boolean;
  onChange: (dateText: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  // 이 폼이 열려 있는 동안 "오늘"은 한 값이다(렌더마다 다시 물으면 자정을 넘길 때 격자와
  // 판정이 갈린다).
  const [todayIso] = useState(() => getSeoulToday());
  return (
    <View style={{ gap: 6 }}>
      <Text style={fieldLabelStyle}>{dateLabel}</Text>
      {/* 라운드 65 D: 손타이핑 칸 + 달력 버튼(48dp) — 지출 입력 시트의 날짜 줄과 같은 문법. */}
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <TextInput
          accessibilityLabel={`${dateLabel} 입력`}
          // 라운드 45 UX-Y(S): ONB-002와 같은 키보드 값 + YYYY-MM-DD 10자 제한.
          // 라운드 45 O-7(주석 정정): numbers-and-punctuation은 iOS 숫자·기호 키보드이고,
          // Android는 기본 키보드 + maxLength만 적용된다. 검증은 기존
          // validateChildForm/computeDateError 그대로.
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          returnKeyType="done"
          onChangeText={onChange}
          placeholder="YYYY-MM-DD"
          style={[fieldInputStyle, { flex: 1 }, showErrors && error ? fieldInputErrorStyle : null]}
          value={value}
        />
        <Pressable
          accessibilityLabel={`${dateLabel} 달력에서 고르기`}
          accessibilityRole="button"
          accessibilityState={{ expanded: pickerOpen }}
          onPress={() => setPickerOpen((open) => !open)}
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: theme.colors.white,
            borderColor: "rgba(74, 63, 53, 0.10)",
            borderRadius: 14,
            borderWidth: 1,
            height: 48,
            justifyContent: "center",
            opacity: pressed ? 0.76 : 1,
            width: 48
          })}
        >
          <AppIcon color={theme.colors.mainCoral} name="calendar-blank-outline" size={22} />
        </Pressable>
      </View>
      {/* 지출 화면과 **같은 픽커**다. 고른 날짜는 손타이핑 칸과 같은 onChange로 들어가므로
          검증(validateChildForm)·저장 payload가 보는 값이 하나뿐이다. */}
      {pickerOpen ? (
        <ExpenseDatePicker
          direction={direction}
          onSelectDate={(dateIso) => {
            onChange(dateIso);
            setPickerOpen(false);
          }}
          selectedIso={value}
          todayIso={todayIso}
        />
      ) : null}
      {showErrors && error ? <Text style={fieldErrorStyle}>{error}</Text> : null}
    </View>
  );
}

/** Shared form fields (nickname + mode-appropriate date + manual stage chips) for edit/add. */
function ChildFormFields({
  stageMode,
  values,
  onChange,
  showErrors
}: {
  stageMode: ChildStageMode;
  values: ChildFormValues;
  onChange: (values: ChildFormValues) => void;
  showErrors: boolean;
}) {
  const errors = validateChildForm(stageMode, values, { requireDate: true });
  const dateLabel = requiredDateFieldLabel(stageMode);
  return (
    <View style={{ gap: theme.spacing.gap }}>
      <View style={{ gap: 6 }}>
        <Text style={fieldLabelStyle}>태명 / 별명</Text>
        <TextInput
          accessibilityLabel="태명 또는 별명 입력"
          returnKeyType="done"
          onChangeText={(nickname) => onChange({ ...values, nickname })}
          placeholder="예) 튼튼이"
          style={[fieldInputStyle, showErrors && errors.nicknameError ? fieldInputErrorStyle : null]}
          value={values.nickname}
        />
        {showErrors && errors.nicknameError ? <Text style={fieldErrorStyle}>{errors.nicknameError}</Text> : null}
      </View>

      {dateLabel ? (
        <ChildDateField
          dateLabel={dateLabel}
          direction={childDatePickerDirection(stageMode)}
          value={values.dateText}
          error={errors.dateError}
          showErrors={showErrors}
          onChange={(dateText) => onChange({ ...values, dateText })}
        />
      ) : null}

      {stageMode === "manual" ? (
        <View style={{ gap: 6 }}>
          <Text style={fieldLabelStyle}>아이 단계 선택</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {CHILD_STAGE_CODES.map((code) => (
              <CategoryChip
                key={code}
                label={CHILD_STAGE_LABELS[code]}
                selected={values.manualStage === code}
                onPress={() => onChange({ ...values, manualStage: code })}
              />
            ))}
          </View>
          {showErrors && errors.manualStageError ? <Text style={fieldErrorStyle}>{errors.manualStageError}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function formValuesForChild(child: Child): ChildFormValues {
  return {
    nickname: child.nickname,
    dateText: child.stageMode === "pregnant" ? (child.dueDate ?? "") : child.stageMode === "born" ? (child.birthDate ?? "") : "",
    manualStage: child.manualStage
  };
}

export default function ManageChildrenScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const sessionUserId = useSessionStore((state) => state.userId);
  const userId = sessionUserId ?? (isTestSession ? LOCAL_USER_ID : null);
  const sessionHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  // 라운드 60 A: 세션의 기본 가구는 이제 **폴백**이다 -- 대상 가구는 아래 children 조회 뒤에
  // 선택된 아이 기준으로 정한다(src/family/household-scope.ts).
  const fallbackHouseholdId = sessionHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);
  const knownHouseholdIds = useSessionStore((state) => state.householdIds);
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);
  const queryClient = useQueryClient();

  // FIX-118B(F3): the demo session talks to the in-memory local backend, whose createChild only
  // renames the single fixture child -- 아이 추가 cannot honestly succeed there.
  const isDemoSession = authToken === LOCAL_SESSION_TOKEN;

  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  // CHILD-127: the 아이가 태어났어요 전환 카드 (birth-date entry) is its own open/error state so it
  // never fights the edit form for `form`/`showErrors`.
  const [bornChildId, setBornChildId] = useState<string | null>(null);
  const [bornDateText, setBornDateText] = useState("");
  const [bornShowErrors, setBornShowErrors] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addStageMode, setAddStageMode] = useState<ChildStageMode>("born");
  const [form, setForm] = useState<ChildFormValues>(emptyForm);
  const [showErrors, setShowErrors] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  /**
   * 라운드 52 C-07: 아이 프로필 저장/추가는 아웃박스를 거치지 않는 서버 직행 쓰기라 오프라인에서는
   * 그냥 실패한다. 그때 "잠시 후 다시 시도해 주세요"는 기다릴 대상이 있다는 뜻이라 사실과
   * 어긋난다 -- 실패한 그 순간에 연결을 한 번 확인해 문구를 고른다(src/offline/messages.ts).
   *
   * 라운드 52 QA P3-1: 그 확인은 조회 실패 카드와 **같은 공용 훅**이 한다(useSaveErrorCopy).
   * 예전에는 각 뮤테이션의 onError가 직접 폴을 띄워, 저장 실패 직후 화면을 떠나면 사라진
   * 화면에 setState가 걸렸다 -- 이 화면이 토스트 타이머에 대해 지키는 "never setState after
   * unmount" 규율을 문구 쪽만 지키지 않고 있던 셈이다. 훅의 cancelled 패턴이 그 자리를 덮고,
   * 뮤테이션이 성공/초기 상태로 돌아가면 문구도 기본값으로 복원된다.
   *
   * 라운드 70 리뷰(M-2): 세 뮤테이션(편집·출생 전환·추가)은 **각자의 자리**에 자기 문장을
   * 그린다 -- 훅을 셋으로 나눈 이유와 그 갈래는 아래 세 호출부 주석에 있다.
   */
  // Same timer-in-ref discipline as more.tsx's export toast: never setState after unmount.
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // FIX-118B(F2): Idempotency-Key holder for 아이 추가 -- see child-create-idempotency.ts.
  const addIdempotencyKeyRef = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);
  const showToast = (message: string, tone: "success" | "error") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, tone });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3200);
  };

  const hasSession = Boolean(authToken);
  const children = useQuery({
    queryKey: ["children"],
    enabled: hasSession,
    queryFn: () => listChildren(authToken!)
  });
  /**
   * 라운드 60 A — 이 화면이 **쓰는** 가구.
   *
   * 아이 추가가 만들어 온 것은 늘 `defaultHouseholdId`의 아이였다. 그 값은 다른 가구 초대를
   * 수락하는 순간 영구히 바뀌므로, 수락 뒤에 추가한 둘째가 시가 가구에 생기고(앱 안에서
   * 되돌릴 수 없다) 그 가족이 아이의 지출을 열람하게 됐다. 이제 대상은 **선택된 아이의 가구**
   * 이고, 아이가 0명인 첫 가입 계정에서는 종전대로 기본 가구다(그것이 아는 유일한 사실).
   * 역할 게이트도 같은 가구를 물어야 한다 -- 아니면 A 가구 owner가 B 가구 viewer로 잠긴다.
   */
  const scopedHouseholdId = resolveManagedHouseholdId({
    children: children.data?.children,
    childId: selectedChildId,
    fallbackHouseholdId,
    childrenSettled: isChildrenSettled({ authToken, isSuccess: children.isSuccess, isError: children.isError })
  });
  /**
   * 라운드 63 #7 — 가족 화면이 **가구를 전환한 채로** 보냈다면 그 가구에 아이를 만든다.
   *
   * 위 판정만으로는 **아이가 하나도 없는 가구를 영영 가리킬 수 없다**(1단계는 선택 아이의 가구,
   * 3단계는 기본 가구). 그래서 초대를 수락해 들어간 빈 가구는 라운드 62 #4 이후 볼 수도 나갈 수도
   * 있게 됐지만, 정작 그 가구를 만든 목적("여기에 우리 아이를 등록한다")은 여전히 불가능했다 --
   * 아이 추가는 언제나 내 아이의 가구(또는 기본 가구)로 갔고, 화면은 그 사실을 정직하게 말하기까지
   * 했다("… 가구에 추가돼요."). 전환은 가족 화면의 지역 상태라(app/family/index.tsx의
   * `viewedHouseholdId`) 이 화면에서는 보이지 않으므로, 초대 화면·탈퇴 화면과 **같은 관례**로
   * 파라미터를 받는다(라운드 61 #3 · 62 #4 — 규칙 한 벌은 src/family/household-scope.ts).
   *
   * 파라미터는 **아는 가구일 때만** 통과한다(collectKnownHouseholdIds 화이트리스트 — 아이의 가구 ·
   * 서버가 말한 목록 · 기본 가구). 모르는 값은 조용히 무시하고 종전의 아이 기준 판정으로 떨어진다:
   * **검증 실패는 차단이 아니다.** 매 렌더에서 다시 검증하므로(effect로 상태를 만들지 않는다)
   * 아이 목록이 늦게 도착해 화이트리스트가 넓어지면 그때 통과한다.
   *
   * 이 값 하나가 **추가 폼 셋**(생성 대상 `buildCreateChildBody(householdId!, …)` · 그 가구의
   * 역할 `["household-members", householdId]` · 대상 표기 `addHouseholdNotice`)의 근거다. 셋이
   * 갈리면 라벨이 곧 거짓말이 된다. 서버는 그대로다 -- `POST /children`은 이미 본문의 householdId를
   * 받고 그 가구의 역할을 가드로 검사한다(apps/api children.controller.ts).
   *
   * ⚠️ **여기까지다.** 라운드 63 리뷰 #1: 이 값이 아래 **목록**의 게이트(편집 · 출생 전환 ·
   * 보기 전용 안내)까지 지배하면 안 된다 — 그 목록은 파라미터 가구의 아이가 아니라 이 계정이
   * 아는 **전 가구의 아이**이기 때문이다(`children.data.children` 그대로). 지배하게 두면 빈 가구
   * B의 owner가 B로 전환해 들어온 순간 시가 가구 A(viewer)의 아이 행에 [편집]이 서고, 눌러야
   * 403을 만난다 — 라운드 40이 없앤 **보기 전용 허위 표시**의 부활이다. 역방향(A owner가 B
   * viewer로 전환)에서는 정작 자기 아이의 편집이 사라진다.
   *
   * 1가구 계정에서는 가족 화면이 전환 자체를 못 하므로 **파라미터가 생기지 않고**, 이 화면은
   * 종전과 한 글자도 달라지지 않는다(SET-005).
   */
  const params = useLocalSearchParams<{ householdId?: string | string[] }>();
  const requestedHouseholdId = parseHouseholdScopeParam(
    params[HOUSEHOLD_SCOPE_PARAM],
    collectKnownHouseholdIds({
      children: children.data?.children,
      knownHouseholdIds,
      fallbackHouseholdId
    })
  );
  const householdId = requestedHouseholdId ?? scopedHouseholdId;
  /**
   * **목록**의 역할 게이트 — 근거는 언제나 `scopedHouseholdId`(선택된 아이의 가구, 없으면 기본
   * 가구)다. 라운드 63 리뷰 #1로 파라미터 가구와 분리했다: 위 주석의 근거를 참고.
   *
   * (더 정직한 형태는 각 행의 `child.householdId`별로 묻는 것이지만, 그러려면 가구마다 멤버
   * 조회가 하나씩 생긴다 — 이번 라운드는 **종전 판정 복원**까지만 한다. 오늘도 목록에는 여러
   * 가구의 아이가 섞여 있을 수 있고 그 경우의 게이트는 종전과 똑같이 부정확하다: 이 리뷰가
   * 되돌리는 것은 파라미터가 그 부정확함을 **새로 키운** 부분이다.)
   *
   * Role gate (same lookup convention as app/family/index.tsx): editing is owner/co_parent
   * only; while members are still loading we default to view-only rather than flashing edit
   * controls a viewer must not use.
   */
  const scopedMembers = useQuery({
    queryKey: ["household-members", scopedHouseholdId],
    enabled: Boolean(authToken && scopedHouseholdId),
    queryFn: () => listHouseholdMembers(authToken!, scopedHouseholdId!)
  });
  const myRole = scopedMembers.data?.members.find((member) => member.userId === userId)?.role;
  /**
   * ⚠️ 라운드 70 정찰 P3 — **앱에는 역할 판정 근거가 두 벌 있다.** 여기(그리고 app/family/index.tsx)는
   * **구성원 목록 응답**에서 내 역할을 찾고, 나머지 전부(`useExpenseEntryGate` → record-permissions.ts)는
   * **세션 스토어의 역할 표**에서 찾는다.
   *
   * 지금 이 화면이 응답 쪽을 쓰는 것은 정당하다: 어차피 이 쿼리를 부르고 있고(`scopedMembers`),
   * 그 응답이 세션 스토어의 표보다 언제나 최신이다. 다만 **두 판정이 다른 답을 내는 창이 존재한다** —
   * 스토어 표가 낡은 동안(역할이 서버에서 바뀌었는데 /me 재검증이 아직 돌지 않은 구간) 같은 계정이
   * 이 화면에서는 편집 컨트롤을 보고 지출·예산 화면에서는 잠기거나 그 반대일 수 있다. 두 판정의
   * 안전 방향이 다른 것도 의도다: 여기는 **로딩 중 보기 전용**으로 떨어지고(아래 주석), 게이트 쪽은
   * **모르면 잠그지 않는다**(record-permissions.ts 머리말의 근거 — 잘못 잠그면 핵심 루프가 죽는다).
   *
   * 한 벌로 합치는 것은 이 트랙의 일이 아니다(게이트 훅은 호출부가 여섯 화면이고 이 트랙이 소유하지
   * 않는다). 관계를 적어 두는 것까지가 라운드 70 B의 몫이다.
   */
  const canEditChildren = myRole === "owner" || myRole === "co_parent";
  /**
   * 라운드 71 트랙 E — **머리말이 판정을 읽는다.** 이 화면의 첫 문장은 종전에 모두에게
   * "아이를 전환하거나 정보를 수정해요"라고 말했고, 보기 전용 참여자에게는 아래의 편집 컨트롤이
   * 하나도 서지 않았다 — 화면이 자기 자신과 모순됐다.
   *
   * ⚠ 그런데 머리말의 판정은 `canEditChildren`의 부정이 **아니다**. 그 값은 구성원 목록이 아직
   * 오는 중이거나(로딩) 응답에서 나를 찾지 못했을 때도 false로 떨어지도록 일부러 그렇게 만든
   * 것이라(위 주석 — 뷰어가 못 쓸 컨트롤을 깜빡이는 것보다 낫다), 그대로 머리말에 쓰면 **모르는
   * 상태의 정상 사용자에게 "당신은 보기 전용이에요"라고 말하는 허위 표시**가 된다. 머리말은
   * 게이트 쪽 규칙을 그대로 따른다 — **알려진 보기 전용 역할일 때만** 잠근다(record-permissions.ts의
   * 그 판정 하나를 읽는다. 새 판정 0건 · 역할 미상·비세션·데모는 종전 문장 그대로다).
   *
   * 컨트롤의 게이트(`canEditChildren`)는 **한 글자도 바뀌지 않는다**: 두 판정의 안전 방향이
   * 다른 것이 의도이고(위 주석), 이 트랙이 만지는 것은 첫 문장 하나뿐이다.
   */
  const childEditViewOnly = isExpenseEntryLocked({ hasSession, role: myRole });
  /**
   * **추가 폼**의 역할 게이트 — 근거는 파라미터가 가리키는 대상 가구(`householdId`)다. 생성이
   * 실제로 가는 곳의 역할을 물어야 빈 가구 B의 owner가 B에 아이를 만들 수 있고(라운드 63 #7),
   * 반대로 뷰어로 전환해 들어온 가구에는 추가 폼이 서지 않는다.
   *
   * 전환하지 않은 계정에서는 `householdId === scopedHouseholdId`라 **쿼리 키가 같다** — react-query가
   * 같은 캐시 항목을 공유하므로 요청은 한 번뿐이고 두 판정은 언제나 같은 값이다(SET-005 불변).
   */
  const members = useQuery({
    queryKey: ["household-members", householdId],
    enabled: Boolean(authToken && householdId),
    queryFn: () => listHouseholdMembers(authToken!, householdId!)
  });
  const myAddRole = members.data?.members.find((member) => member.userId === userId)?.role;
  const canAddChild = myAddRole === "owner" || myAddRole === "co_parent";

  const invalidateChildScopedQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ["children"] });
    await Promise.all(
      CHILD_SCOPED_QUERY_KEY_PREFIXES.map((key) => queryClient.invalidateQueries({ queryKey: [...key] }))
    );
  };

  const saveEdit = useMutation({
    mutationFn: (input: { child: Child; values: ChildFormValues }) =>
      updateChild(authToken!, input.child.id, buildUpdateChildBody(input.child.stageMode, input.values)),
    onSuccess: async (updated) => {
      setEditingChildId(null);
      setShowErrors(false);
      // A birth/due-date change moves the server-computed stage, which drives 준비템 추천
      // 밴드와 홈/리포트 -- refresh everything child-scoped, not just the list.
      await invalidateChildScopedQueries();
      showToast(`${updated.nickname} 정보를 저장했어요.`, "success");
    }
  });

  /**
   * CHILD-127: 임신 → 출생 전환. 서버는 stageMode와 birthDate를 한 요청에 함께 받아야 하고
   * (CHILD_STAGE_INPUT_REQUIRED), 되돌릴 수 없다. 전환은 currentStage/준비템 밴드/홈/리포트를
   * 전부 바꾸므로 편집과 똑같이 아이 스코프 캐시를 모두 무효화한다.
   */
  const markChildBorn = useMutation({
    mutationFn: (input: { child: Child; values: ChildFormValues }) =>
      updateChild(
        authToken!,
        input.child.id,
        buildUpdateChildBody(input.child.stageMode, input.values, { transitionToStageMode: "born" })
      ),
    onSuccess: async (updated) => {
      setBornChildId(null);
      setBornDateText("");
      setBornShowErrors(false);
      await invalidateChildScopedQueries();
      showToast(`${updated.nickname} 정보를 출생일 기준으로 바꿨어요.`, "success");
      announceForA11y(`${updated.nickname} 화면이 출생일 기준으로 바뀌었어요.`);
    }
  });

  const addChild = useMutation({
    mutationFn: (input: { stageMode: ChildStageMode; values: ChildFormValues }) =>
      createChild(
        authToken!,
        buildCreateChildBody(householdId!, input.stageMode, input.values),
        // FIX-118B(F2): one key per input session, reused by every retry of THIS submission --
        // a lost response can no longer be retried into a second child.
        getOrCreateChildCreateKey(addIdempotencyKeyRef)
      ),
    onSuccess: async (created, input) => {
      // 성공 시 회전: the next 아이 추가 must be a genuinely new creation, not a replay of this one.
      rotateChildCreateKey(addIdempotencyKeyRef);
      setAddOpen(false);
      setShowErrors(false);
      setForm(emptyForm);
      // Select the newly added child right away (same behavior as onboarding ONB-002).
      setSelectedChildId(created.id);
      await invalidateChildScopedQueries();
      /**
       * 라운드 63 #7 — 전환해 들어온 흐름에서는 **전환이 일어났다는 사실**도 함께 말한다.
       *
       * 위 한 줄(`setSelectedChildId`)이 "가구 전환"을 조용히 "아이 전환"으로 승격시킨다 --
       * 사용자가 방금 만든 아이의 홈으로 앱 전체가 옮겨 간다. 이 흐름에서는 그게 맞지만
       * (만들자마자 그 아이를 보러 간다) 말해 주지 않으면 다른 가구를 보러 왔던 사람은 홈이
       * 바뀐 이유를 모른다. 파라미터가 없는 계정(1가구 계정 포함)에서는 종전 문구 그대로다.
       */
      const addedNotice = `${input.values.nickname.trim()}를 추가했어요.`;
      const switchNotice = requestedHouseholdId ? ` ${HOUSEHOLD_SCOPE_ADD_CHILD_SWITCH_NOTICE}` : "";
      showToast(`${addedNotice}${switchNotice}`, "success");
      announceForA11y(`${input.values.nickname.trim()}를 추가하고 선택했어요.${switchNotice}`);
    }
  });

  /**
   * C-07/QA P3-1: 세 뮤테이션의 저장 실패 문구(위 주석 참고).
   *
   * 라운드 70 B — 라운드 69가 `src/api/api-error.ts`에 남긴 배선 빚을 여기서 갚는다. 그 파일은
   * `CHILD_BIRTH_DATE_TOO_OLD`를 표에 세워 두면서 "이 코드는 아웃박스를 타지 않고(아이 저장에는
   * 큐가 없다), 지금 그 화면은 실패를 `useSaveErrorCopy`의 일반 문구로 접는다 — 배선은 그 화면을
   * 여는 라운드의 몫"이라고 적어 뒀다. 실패 값을 함께 넘기는 것이 그 배선이다: 20년보다 오래된
   * 출생일로 저장이 거절되면 이제 화면이 **그 사실**을 말하고(폼의 문장과 같은 단일 소스다),
   * 표에 없는 실패는 종전 두 문장 그대로다.
   *
   * 라운드 70 리뷰(M-2) — **자리마다 자기 뮤테이션의 사유다.**
   *
   * 종전에는 훅 하나가 세 상태의 OR과 세 실패의 `??` 체인을 받아 **한 문장**을 만들고, 그
   * 문장을 세 자리(출생 전환 카드·편집 폼·추가 폼)가 함께 그렸다. 그런데 그 세 자리는 동시에
   * 떠 있을 수 있고(각 카드는 서로 다른 상태로 열린다) `??`는 언제나 **먼저 실패한 것**을
   * 고른다 — 편집이 날짜 하한으로 실패한 채 고착되면, 그다음 추가 실패는 자기 자리에서
   * "20년보다 오래된…"이라는 **남의 사유**로 읽힌다. 사유를 말할 수 있게 된 라운드 70 B가
   * 정확히 그만큼 오표시의 여지도 함께 만든 셈이다.
   *
   * 그래서 자리마다 자기 뮤테이션을 묻는다. 훅 호출 수는 **언제나 셋으로 고정**이라(조건부
   * 호출이 아니다) hooks 규칙에 안전하고, 각 훅의 연결 판정도 자기 뮤테이션의 실패 전환에만
   * 걸린다 — 종전에는 셋 중 하나만 실패해도 세 자리의 판정이 함께 움직였다.
   */
  const editFailedText = useSaveErrorCopy(saveEdit.isError, saveEdit.error);
  const bornFailedText = useSaveErrorCopy(markChildBorn.isError, markChildBorn.error);
  const addFailedText = useSaveErrorCopy(addChild.isError, addChild.error);

  // HOME-138: 전환의 부수효과 순서(스토어 쓰기 → 아이 스코프 캐시 무효화 → 안내)는
  // applyChildSwitch 한 곳에만 있다 -- 홈 헤더 1탭 전환이 같은 함수를 부른다.
  const handleSelect = (child: Child) => {
    applyChildSwitch(selectedChildId, child, {
      setSelectedChildId,
      invalidateQueries: (input) => queryClient.invalidateQueries(input),
      announce: announceForA11y
    });
  };

  const startEdit = (child: Child) => {
    setAddOpen(false);
    setShowErrors(false);
    setBornChildId(null);
    saveEdit.reset();
    setEditingChildId(child.id);
    setForm(formValuesForChild(child));
  };

  const startBornTransition = (child: Child) => {
    setAddOpen(false);
    setEditingChildId(null);
    setBornShowErrors(false);
    setBornDateText("");
    markChildBorn.reset();
    setBornChildId(child.id);
  };

  const bornTransitionValues = (child: Child): ChildFormValues => ({
    nickname: child.nickname,
    dateText: bornDateText,
    manualStage: null
  });

  const submitBornTransition = (child: Child) => {
    setBornShowErrors(true);
    const values = bornTransitionValues(child);
    // 출생일은 편집 폼과 같은 규칙으로 검증한다 (형식·실재하는 날짜·미래 금지, 빈 값 금지).
    const errors = validateChildForm("born", values, { requireDate: true });
    if (!isChildFormValid(errors) || markChildBorn.isPending) return;
    if (!canTransitionStageMode(child.stageMode, "born")) return;
    Alert.alert(BORN_TRANSITION_CONFIRM_TITLE, BORN_TRANSITION_CONFIRM_MESSAGE, [
      { text: "취소", style: "cancel" },
      { text: BORN_TRANSITION_CONFIRM_CTA, onPress: () => markChildBorn.mutate({ child, values }) }
    ]);
  };

  const startAdd = () => {
    setEditingChildId(null);
    setBornChildId(null);
    setShowErrors(false);
    addChild.reset();
    // 입력 세션당 1키: opening the form starts a new idempotency scope (a previous session's
    // key must never dedupe this one away).
    rotateChildCreateKey(addIdempotencyKeyRef);
    setAddOpen(true);
    setAddStageMode("born");
    setForm(emptyForm);
  };

  const submitEdit = (child: Child) => {
    setShowErrors(true);
    const errors = validateChildForm(child.stageMode, form, { requireDate: true });
    if (!isChildFormValid(errors) || saveEdit.isPending) return;
    saveEdit.mutate({ child, values: form });
  };

  const submitAdd = () => {
    setShowErrors(true);
    const errors = validateChildForm(addStageMode, form, { requireDate: true });
    // isDemoSession도 방어적으로 막는다: 데모에서는 폼 자체가 열리지 않지만(F3),
    // 어떤 경로로든 여기 도달해도 허위 성공 토스트를 만들지 않게 한다.
    if (!isChildFormValid(errors) || addChild.isPending || !householdId || isDemoSession) return;
    addChild.mutate({ stageMode: addStageMode, values: form });
  };

  const childList = children.data?.children ?? [];
  const editingChild = childList.find((child) => child.id === editingChildId) ?? null;
  /**
   * 라운드 60 A: **다가구 계정에서만** 붙는 한 줄("… 가구에 추가돼요."). 가구가 하나뿐이거나
   * 몇인지 모르면 null이라 폼이 종전과 한 글자도 달라지지 않고, 가구를 가리킬 사실(서버가 준
   * 이름 · 그 가구의 아이)이 없으면 역시 아무것도 적지 않는다 -- 지어내지 않는다.
   *
   * 라운드 63 #7: **전환해 들어온 가구에서만** 한 자리 더 내려간다. 이 흐름의 주인공은 아이가
   * 하나도 없는 가구인데, 그 가구는 이름도 없고 가리킬 아이도 없어 위 판정이 언제나 null이다 --
   * 즉 이 라운드가 여는 바로 그 경로에서만 "어디에 추가되는지"를 말하지 못한다. 그래서 가족
   * 화면의 전환 목록이 같은 자리에서 이미 쓰는 **사실 표기**를 그대로 재사용한다
   * (`HOUSEHOLD_SCOPE_EMPTY_LABEL` — 이름을 지어내는 것이 아니라 "아이가 아직 없는 가구"라는
   * 사실이다). 파라미터가 없는 계정에서는 이 자리가 생기지 않으므로 1가구 계정은 종전 그대로다.
   *
   * 라운드 63 리뷰 #1: 여기서 읽는 멤버는 **대상 가구**의 것(`members`)이다 — 이 줄이 가리키는
   * 대상이 생성이 실제로 가는 그 가구이기 때문이다. 목록 게이트가 보는 `scopedMembers`와 갈리는
   * 것이 정상이고, 전환하지 않은 계정에서는 둘이 같은 캐시 항목이다.
   */
  const addHouseholdNotice = householdScopeAddChildNotice(
    householdScopePhrase(
      describeHouseholdScope({
        householdId,
        children: children.data?.children,
        members: members.data?.members,
        knownHouseholdIds,
        fallbackHouseholdId
      })
    ) ?? (requestedHouseholdId ? HOUSEHOLD_SCOPE_EMPTY_LABEL : null)
  );

  return (
    <AppScreen>
      <View testID="screen-SET-005" style={{ gap: theme.spacing.section }}>
        <ScreenHeader
          eyebrow="설정"
          title="아이 관리"
          subtitle={childEditViewOnly ? VIEW_ONLY_HEADLINES.children : "아이를 전환하거나 정보를 수정해요"}
          onBack={() => router.back()}
        />

        {/* 라운드 71 트랙 E: 문구 무변경 + 목적지 하나(가짜 버튼 → 로그인 화면). */}
        {!hasSession ? (
          <EmptyStateCard title="로그인 후 이용할 수 있어요." actionLabel="확인" onPress={() => router.push("/login")} />
        ) : null}

        {hasSession && children.isLoading ? (
          <Card>
            <Text style={mutedTextStyle}>불러오는 중이에요...</Text>
          </Card>
        ) : null}

        {hasSession && children.isError ? (
          <Card style={{ gap: 10 }}>
            <Text style={{ color: theme.colors.danger }}>불러오지 못했어요. 잠시 후 다시 시도해 주세요.</Text>
            <SecondaryButton label="다시 시도" onPress={() => children.refetch()} />
          </Card>
        ) : null}

        {hasSession && children.isSuccess && childList.length === 0 ? (
          <EmptyStateCard title="등록된 아이가 없어요" actionLabel="새로고침" onPress={() => children.refetch()} />
        ) : null}

        <View style={{ gap: theme.spacing.gap }}>
          {childList.map((child) => {
            const selected = child.id === selectedChildId;
            return (
              <Card key={child.id} style={{ gap: 10 }}>
                <View style={childRowStyle}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={selected ? `${child.nickname}, 현재 선택된 아이` : `${child.nickname}(으)로 전환`}
                    hitSlop={8}
                    onPress={() => handleSelect(child)}
                    style={{ flex: 1, gap: 2 }}
                  >
                    <Text style={childNameStyle}>{child.nickname}</Text>
                    {/* GAP-061 #10: 예정일이 유예를 넘겨 지난 임신 프로필의 "임신 42주차" 고착을
                        표시층에서만 사실 문구로 바꾼다(도메인 stageCode·계산 불변). */}
                    <Text style={childStageStyle}>
                      {resolveStageDisplayLabel({
                        stageMode: child.stageMode,
                        dueDate: child.dueDate,
                        todayIso: getSeoulToday(),
                        stageLabel: child.stageLabel
                      })}
                    </Text>
                  </Pressable>
                  {selected ? <StatusBadge label="현재 선택" tone="success" /> : null}
                  {canEditChildren ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${child.nickname} 정보 편집`}
                      hitSlop={8}
                      onPress={() => (editingChildId === child.id ? setEditingChildId(null) : startEdit(child))}
                    >
                      <Text style={editLinkStyle}>{editingChildId === child.id ? "닫기" : "편집"}</Text>
                    </Pressable>
                  ) : null}
                </View>

                {/* CHILD-127: 임신 중으로 가입한 아이만 노출되는 단방향 전환 액션. */}
                {canEditChildren && canTransitionStageMode(child.stageMode, "born") && bornChildId !== child.id ? (
                  <SecondaryButton
                    accessibilityLabel={`${child.nickname} 출생일을 입력하고 출생일 기준으로 바꾸기`}
                    label={BORN_TRANSITION_ACTION_LABEL}
                    onPress={() => startBornTransition(child)}
                  />
                ) : null}

                {canEditChildren && bornChildId === child.id ? (
                  <View style={{ gap: theme.spacing.gap }}>
                    <Text style={mutedTextStyle}>
                      출생일을 입력하면 지금부터 출생일 기준으로 단계와 준비템을 보여드려요. 저장한 출산 예정일은 그대로
                      남아 있어요.
                    </Text>
                    <ChildDateField
                      dateLabel={requiredDateFieldLabel("born")!}
                      // 출생 전환의 날짜는 출생일이다 — 편집 폼의 출생일과 같은 방향을 같은
                      // 판정에서 받는다(미래 금지).
                      direction={childDatePickerDirection("born")}
                      value={bornDateText}
                      error={validateChildForm("born", bornTransitionValues(child), { requireDate: true }).dateError}
                      showErrors={bornShowErrors}
                      onChange={setBornDateText}
                    />
                    {markChildBorn.isError ? <Text style={{ color: theme.colors.danger }}>{bornFailedText}</Text> : null}
                    <PrimaryButton
                      disabled={markChildBorn.isPending}
                      label={markChildBorn.isPending ? "바꾸는 중" : "출생일로 바꾸기"}
                      onPress={() => submitBornTransition(child)}
                    />
                    <SecondaryButton label="취소" onPress={() => setBornChildId(null)} />
                  </View>
                ) : null}

                {editingChild && editingChild.id === child.id ? (
                  <View style={{ gap: theme.spacing.gap }}>
                    <ChildFormFields
                      stageMode={editingChild.stageMode}
                      values={form}
                      onChange={setForm}
                      showErrors={showErrors}
                    />
                    {saveEdit.isError ? <Text style={{ color: theme.colors.danger }}>{editFailedText}</Text> : null}
                    <PrimaryButton
                      disabled={saveEdit.isPending}
                      label={saveEdit.isPending ? "저장하는 중" : "저장"}
                      onPress={() => submitEdit(editingChild)}
                    />
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>

        {/* 이 안내는 **목록의 편집**이 왜 없는지를 말하므로 목록과 같은 판정을 쓴다(리뷰 #1). */}
        {hasSession && !canEditChildren && scopedMembers.isSuccess ? (
          <Card>
            <Text style={mutedTextStyle}>보기 전용 멤버는 아이 정보를 수정할 수 없어요.</Text>
          </Card>
        ) : null}

        {/* FIX-118B(F3): 데모 세션에서는 추가가 실제로 일어나지 않으므로 버튼 대신 안내만 둔다. */}
        {/* 아래 셋은 전부 **추가**의 게이트라 대상 가구의 역할(canAddChild)을 묻는다(리뷰 #1). */}
        {hasSession && canAddChild && isDemoSession ? (
          <Card>
            <Text style={mutedTextStyle}>데모에서는 아이를 추가할 수 없어요. 로그인하면 아이를 추가할 수 있어요.</Text>
          </Card>
        ) : null}

        {hasSession && canAddChild && !isDemoSession && !addOpen ? (
          <SecondaryButton accessibilityLabel="아이 추가" label="아이 추가" onPress={startAdd} />
        ) : null}

        {hasSession && canAddChild && !isDemoSession && addOpen ? (
          <Card style={{ gap: theme.spacing.gap }}>
            <Text style={addTitleStyle}>새 아이 추가</Text>
            {addHouseholdNotice ? <Text style={mutedTextStyle}>{addHouseholdNotice}</Text> : null}
            <View style={{ gap: 6 }}>
              <Text style={fieldLabelStyle}>지금 상황</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {CHILD_STAGE_MODE_OPTIONS.map((option) => (
                  <CategoryChip
                    key={option.mode}
                    label={option.label}
                    selected={addStageMode === option.mode}
                    onPress={() => {
                      setAddStageMode(option.mode);
                      setForm((current) => ({ ...current, dateText: "", manualStage: null }));
                    }}
                  />
                ))}
              </View>
            </View>
            <ChildFormFields stageMode={addStageMode} values={form} onChange={setForm} showErrors={showErrors} />
            {addChild.isError ? <Text style={{ color: theme.colors.danger }}>{addFailedText}</Text> : null}
            <PrimaryButton
              disabled={addChild.isPending}
              label={addChild.isPending ? "추가하는 중" : "추가하기"}
              onPress={submitAdd}
            />
            <SecondaryButton label="취소" onPress={() => setAddOpen(false)} />
          </Card>
        ) : null}

        {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
      </View>
    </AppScreen>
  );
}

const mutedTextStyle = {
  color: theme.colors.gray600,
  fontSize: 13,
  lineHeight: 19
} as const;

const childRowStyle = {
  alignItems: "center",
  flexDirection: "row",
  gap: 10
} as const;

const childNameStyle = {
  color: theme.colors.brown,
  fontSize: 15,
  fontWeight: "800"
} as const;

const childStageStyle = {
  color: theme.colors.gray600,
  fontSize: 12,
  fontWeight: "700"
} as const;

// FIX-118B(F4): coral[500] on cream at 13px is 3.16:1 -- below A11Y-117's own small-coral-text
// rule. coral[700] is the contrast-safe token the shared kit already uses (ui.tsx smallCoralText).
const editLinkStyle = {
  color: theme.colors.coral[700],
  fontSize: 13,
  fontWeight: "700"
} as const;

const addTitleStyle = {
  color: theme.colors.brown,
  fontSize: 15,
  fontWeight: "800"
} as const;

const fieldLabelStyle = {
  color: theme.colors.gray600,
  fontSize: theme.typography.caption.fontSize,
  fontWeight: "700"
} as const;

const fieldInputStyle = {
  backgroundColor: theme.colors.beige,
  borderColor: "transparent",
  borderRadius: theme.radii.small,
  borderWidth: 1,
  color: theme.colors.brown,
  fontSize: theme.typography.body1.fontSize,
  minHeight: theme.touchTarget,
  paddingHorizontal: 14
} as const;

const fieldInputErrorStyle = {
  borderColor: theme.colors.danger
} as const;

const fieldErrorStyle = {
  color: theme.colors.danger,
  fontSize: theme.typography.caption.fontSize
} as const;
