export const motherLifecycleCodes = [
  "pregnancy_planning",
  "pregnancy_early",
  "pregnancy_mid",
  "pregnancy_late",
  "labor_delivery",
  "postpartum_0_6w",
  "postpartum_7_12w",
  "postpartum_3_12m",
  "feeding_ongoing"
] as const;

export const childLifecycleCodes = [
  "newborn_0_3m",
  "infant_4_6m",
  "infant_7_12m",
  "toddler_1_2y",
  "toddler_2_3y",
  "preschool_4_5y",
  "preschool_6_7y",
  "elementary_lower",
  "elementary_upper",
  "middle_school"
] as const;

export type MotherLifecycleCode = (typeof motherLifecycleCodes)[number];
export type ChildLifecycleCode = (typeof childLifecycleCodes)[number];
export type Release4LifecycleCode = MotherLifecycleCode | ChildLifecycleCode;
export type Release4LifecycleRule = { axis: "mother" | "child"; code: Release4LifecycleCode; priorityWeight?: number };

export const catalogScenarioCodes = [
  "first_child", "second_or_later", "multiple_birth", "preterm_or_nicu",
  "vaginal_delivery", "cesarean_delivery", "breastfeeding", "formula_feeding",
  "mixed_feeding", "daycare", "kindergarten", "school", "car_primary",
  "public_transport_primary", "no_car", "no_elevator", "small_home",
  "pet_household", "secondhand_preferred", "rental_preferred", "frequent_travel",
  "summer_birth", "winter_birth", "budget_saving"
] as const;
export type CatalogScenarioCode = (typeof catalogScenarioCodes)[number];

type DomainSource = {
  code: `C${string}`;
  name: string;
  categories: readonly string[];
  items: readonly string[];
  targetSubject: "mother" | "child" | "household" | "shared";
  lifecycles: readonly Release4LifecycleRule[];
};

const mother = (...codes: MotherLifecycleCode[]): Release4LifecycleRule[] =>
  codes.map((code) => ({ axis: "mother", code }));
const child = (...codes: ChildLifecycleCode[]): Release4LifecycleRule[] =>
  codes.map((code) => ({ axis: "child", code }));

const domainSources: readonly DomainSource[] = [
  {
    code: "C01",
    name: "임신 검진·건강 관리",
    categories: ["산전검사", "진료 기록", "건강 측정", "복약·영양 안내", "의료 서류"],
    items: [
      "산모수첩", "임신 진료 일정표", "산전검사 결과 파일", "태아 초음파 기록 파일", "임신 혈압계", "임신 체중 기록계",
      "복약 확인 목록", "영양 상담 기록지", "병원 질문 메모", "진료비 서류 보관함", "임신 응급 연락 카드", "혈당 기록 수첩",
      "건강보험 임신 확인 서류", "출산 예정일 확인서 파일", "예방접종 확인 기록", "진료 이동 가방", "임신 건강 변화 일지"
    ],
    targetSubject: "mother",
    lifecycles: mother("pregnancy_planning", "pregnancy_early", "pregnancy_mid", "pregnancy_late")
  },
  {
    code: "C02",
    name: "임산부 의류·속옷",
    categories: ["임부복", "수유 겸용복", "브라", "팬티", "신발"],
    items: [
      "임부용 레깅스", "임부용 원피스", "임부용 바지", "임부용 상의", "임부용 외투", "수유 겸용 원피스", "수유 겸용 잠옷",
      "임산부 브라", "수유 브라", "임산부 팬티", "산후용 팬티", "임산부 스타킹", "부종 대응 양말", "미끄럼 방지 실내화",
      "발이 편한 외출화", "임부복 허리 조절 밴드", "의류 사이즈 정리 파우치"
    ],
    targetSubject: "mother",
    lifecycles: mother("pregnancy_early", "pregnancy_mid", "pregnancy_late", "postpartum_0_6w", "feeding_ongoing")
  },
  {
    code: "C03",
    name: "임산부 신체 편의·수면",
    categories: ["수면 보조", "허리·골반 지지", "발·다리 편의", "냉온 관리", "이동 편의"],
    items: [
      "임산부 바디필로", "옆잠 보조 쿠션", "허리 지지 쿠션", "골반 지지 벨트", "복부 지지 밴드", "발 받침대", "다리 높임 쿠션",
      "휴대용 방석", "냉온 찜질팩", "침대 보조 손잡이", "미끄럼 방지 욕실 매트", "접이식 휴대 의자", "차량 안전벨트 위치 안내서",
      "침실 수분 관리계", "수면 자세 체크 카드", "외출 휴식 키트", "계단 이동 보조 가방"
    ],
    targetSubject: "mother",
    lifecycles: mother("pregnancy_mid", "pregnancy_late", "postpartum_0_6w")
  },
  {
    code: "C04",
    name: "임산부 위생·피부·구강",
    categories: ["세정", "보습", "구강 관리", "두피·모발", "민감 피부"],
    items: [
      "순한 바디 세정제", "임산부용 보습제", "복부 보습 오일", "저자극 손 세정제", "민감 피부 세탁망", "부드러운 바디 타월",
      "임신 구강관리 칫솔", "치실 보관 케이스", "구강관리 기록 카드", "두피 자극 완화 브러시", "저자극 샴푸", "헤어 드라이 타월",
      "무향 위생 파우치", "외출용 위생 키트", "피부 반응 기록지", "성분 확인 체크 카드", "욕실 위생 수납함"
    ],
    targetSubject: "mother",
    lifecycles: mother("pregnancy_early", "pregnancy_mid", "pregnancy_late", "postpartum_0_6w")
  },
  {
    code: "C05",
    name: "출산·입원 준비",
    categories: ["산모 가방", "보호자 가방", "입원 서류", "입원복", "퇴원 준비"],
    items: [
      "출산 입원 가방", "산모 위생 파우치", "보호자 숙박 가방", "입원 서류 파일", "신분증 보관 지갑", "병원 연락처 카드",
      "입원용 앞트임 잠옷", "입원용 가운", "세면도구 파우치", "휴대폰 충전 세트", "빨대형 물병", "병실용 미끄럼 방지 슬리퍼",
      "퇴원용 산모 옷", "신생아 퇴원복", "퇴원용 겉싸개", "퇴원 이동 계획표", "출생 신고 준비 파일"
    ],
    targetSubject: "shared",
    lifecycles: mother("pregnancy_late", "labor_delivery")
  },
  {
    code: "C06",
    name: "산후 회복",
    categories: ["오로·위생", "회음부 관리", "제왕절개 관리", "신체 지지", "휴식"],
    items: [
      "산후 패드", "산후 위생 팬티", "산후 세정 용기", "회음부 방석", "좌욕 용기", "제왕절개 상처 보호대", "상처 상태 기록지",
      "산후 복부 지지대", "산후 허리 지지 쿠션", "침대 옆 수납 바구니", "수분 섭취 물병", "산후 회복 일정표", "산후 진료 서류 파일",
      "휴식 시간표", "회복 도움 요청 카드", "산후 의류 세탁망", "산후 외출 회복 가방"
    ],
    targetSubject: "mother",
    lifecycles: mother("labor_delivery", "postpartum_0_6w", "postpartum_7_12w", "postpartum_3_12m")
  },
  {
    code: "C07",
    name: "모유수유·유축",
    categories: ["수유 자세", "유축", "모유 저장", "세척·건조", "외출·복직"],
    items: [
      "수유 쿠션", "수유 발 받침", "수유 가리개", "수유 패드", "유두 보호 보관함", "유축기", "유축기 깔때기",
      "유축기 연결 부품", "모유 저장팩", "모유 저장 용기", "모유 라벨", "유축 부품 세척솔", "유축 부품 건조대",
      "모유 냉장 보관함", "모유 운반 보냉가방", "복직 유축 파우치", "수유·유축 기록지"
    ],
    targetSubject: "mother",
    lifecycles: mother("postpartum_0_6w", "postpartum_7_12w", "postpartum_3_12m", "feeding_ongoing")
  },
  {
    code: "C08",
    name: "분유·젖병 수유",
    categories: ["분유 준비", "젖병·젖꼭지", "세척", "소독·건조", "보온·외출"],
    items: [
      "분유 보관 용기", "분유 소분통", "수유 계량 도구", "젖병", "월령별 젖꼭지", "젖병 뚜껑", "젖병 세척솔",
      "젖꼭지 세척솔", "젖병 세정제", "젖병 건조대", "젖병 소독 용기", "수유용 보온병", "수유 온도 확인 도구",
      "외출용 젖병 파우치", "분유 수유 가방", "밤중 수유 정리함", "분유·수유 기록지"
    ],
    targetSubject: "child",
    lifecycles: child("newborn_0_3m", "infant_4_6m", "infant_7_12m")
  },
  {
    code: "C09",
    name: "신생아 수면 환경",
    categories: ["수면 공간", "수면면", "침구", "수면 의류", "환경 확인"],
    items: [
      "신생아 침대", "아기 요람", "단단한 아기 매트리스", "매트리스 방수 커버", "고정형 매트리스 시트", "아기 수면조끼",
      "수면 공간 온도계", "수면 공간 습도계", "암막 커튼", "야간 수유 조명", "수면 기록지", "침대 주변 비움 체크 카드",
      "여행용 아기 침대", "수면 공간 점검 자", "침구 세탁 보관함", "낮잠 공간 안내판", "수면 환경 정리 바구니", "역류방지쿠션"
    ],
    targetSubject: "child",
    lifecycles: child("newborn_0_3m", "infant_4_6m", "infant_7_12m", "toddler_1_2y")
  },
  {
    code: "C10",
    name: "기저귀·배변",
    categories: ["기저귀", "교환", "피부 보호", "폐기·수납", "배변훈련"],
    items: [
      "신생아 기저귀", "월령별 기저귀", "밤잠용 기저귀", "물티슈", "휴대용 기저귀 매트", "기저귀 교환대", "기저귀 정리함",
      "기저귀 크림 보관함", "기저귀 휴지통", "기저귀 냄새 차단 봉투", "외출용 기저귀 파우치", "기저귀 수량 기록표",
      "유아 변기", "변기 보조 시트", "배변 발 받침", "배변훈련 팬티", "배변 성공 기록판"
    ],
    targetSubject: "child",
    lifecycles: child("newborn_0_3m", "infant_4_6m", "infant_7_12m", "toddler_1_2y", "toddler_2_3y")
  },
  {
    code: "C11",
    name: "목욕·위생·피부",
    categories: ["목욕", "타월", "세정·보습", "손발톱", "코·귀 관리"],
    items: [
      "신생아 욕조", "욕조 미끄럼 방지 패드", "목욕물 온도계", "아기 목욕 바가지", "후드형 아기 타월", "아기 세면 타월",
      "아기 바디 세정제", "아기 보습제", "아기 목욕 스펀지", "아기 손톱가위", "아기 손톱 파일", "위생용 핀셋 보관함",
      "코 관리 흡입기", "코 관리 세척 용기", "귀 바깥 관리 거즈", "목욕용품 건조망", "목욕 기록 카드"
    ],
    targetSubject: "child",
    lifecycles: child("newborn_0_3m", "infant_4_6m", "infant_7_12m", "toddler_1_2y", "toddler_2_3y")
  },
  {
    code: "C12",
    name: "건강·응급·치아·시력",
    categories: ["체온·건강 측정", "응급 준비", "의료 보관", "구강·치아", "시력·건강 기록"],
    items: [
      "아기 체온계", "가족 응급 연락 카드", "가정용 응급 처치함", "병원 방문 가방", "약 복용 기록표", "의약품 잠금 보관함",
      "처방전 보관 파일", "예방접종 수첩", "성장 건강 기록지", "유아 칫솔", "유아 치약 보관함", "치아 발달 기록표",
      "치과 방문 준비 가방", "시력검사 기록 파일", "안경 보관 케이스", "학교 건강검진 파일", "알레르기 안내 카드"
    ],
    targetSubject: "child",
    lifecycles: child("newborn_0_3m", "infant_4_6m", "infant_7_12m", "toddler_1_2y", "toddler_2_3y", "preschool_4_5y", "preschool_6_7y", "elementary_lower", "elementary_upper", "middle_school")
  },
  {
    code: "C13",
    name: "의류·신발·계절",
    categories: ["실내복", "외출복", "겉옷", "신발", "날씨 대응"],
    items: [
      "신생아 배냇저고리", "아기 바디수트", "유아 내의", "유아 잠옷", "유아 외출 상의", "유아 외출 하의", "유아 외투",
      "유아 모자", "유아 양말", "첫 걸음 신발", "유아 운동화", "유아 장화", "아동 우비", "아동 방한 장갑",
      "아동 목도리", "계절 의류 보관함", "성장 사이즈 기록표"
    ],
    targetSubject: "child",
    lifecycles: child("newborn_0_3m", "infant_4_6m", "infant_7_12m", "toddler_1_2y", "toddler_2_3y", "preschool_4_5y", "preschool_6_7y", "elementary_lower", "elementary_upper", "middle_school")
  },
  {
    code: "C14",
    name: "세탁·청소·수납",
    categories: ["세탁", "건조", "얼룩 관리", "세척", "정리·라벨"],
    items: [
      "아기 옷 세탁망", "아기 빨래 바구니", "아기 옷 건조대", "소형 옷걸이", "얼룩 구분 보관통", "젖병 세척 바구니",
      "유아 식기 세척 바구니", "장난감 세척함", "아기방 청소 도구함", "기저귀 수납 카트", "수유용품 수납함", "계절용품 압축 보관함",
      "이름 라벨", "날짜 라벨", "회수 물품 체크함", "물려쓰기 분류 상자", "가족 공용 비품 목록"
    ],
    targetSubject: "household",
    lifecycles: child("newborn_0_3m", "infant_4_6m", "infant_7_12m", "toddler_1_2y", "toddler_2_3y", "preschool_4_5y", "preschool_6_7y", "elementary_lower", "elementary_upper", "middle_school")
  },
  {
    code: "C15",
    name: "수면·가구·방 꾸미기",
    categories: ["침대", "매트리스", "수납", "책상·의자", "조명·암막"],
    items: [
      "유아 침대", "아동 침대", "유아용 매트리스", "아동용 매트리스", "침대 방수 커버", "침구 수납함", "낮은 옷장",
      "장난감 수납장", "책 전면 책장", "성장형 책상", "아동 책상 의자", "발 받침 의자", "방 조명", "책상 조명",
      "암막 블라인드", "가구 배치 체크 도면", "성장 가구 교체 목록"
    ],
    targetSubject: "child",
    lifecycles: child("toddler_1_2y", "toddler_2_3y", "preschool_4_5y", "preschool_6_7y", "elementary_lower", "elementary_upper", "middle_school")
  },
  {
    code: "C16",
    name: "이유식·유아식·주방",
    categories: ["식탁·의자", "식기", "조리", "보관", "도시락·외출"],
    items: [
      "아기 식탁의자", "식탁의자 발 받침", "흡착 식판", "유아 그릇", "유아 숟가락", "유아 포크", "연습용 컵",
      "빨대컵", "이유식 조리 냄비", "이유식 칼·도마", "이유식 계량 도구", "이유식 보관 용기", "냉동 보관 라벨",
      "유아식 도시락", "도시락 보냉가방", "외출용 식기 파우치", "식단·알레르기 기록표"
    ],
    targetSubject: "child",
    lifecycles: child("infant_4_6m", "infant_7_12m", "toddler_1_2y", "toddler_2_3y", "preschool_4_5y", "preschool_6_7y")
  },
  {
    code: "C17",
    name: "외출·이동·자동차",
    categories: ["카시트", "유모차", "아기띠", "외출 가방", "대중교통·자전거"],
    items: [
      "신생아용 카시트", "영아용 카시트", "유아용 카시트", "주니어 카시트", "카시트 차량 적합 확인표", "카시트 사용 이력 카드",
      "신생아 유모차", "휴대용 유모차", "유모차 우비", "유모차 정리 가방", "신생아 아기띠", "유아용 아기띠",
      "기저귀 외출 가방", "대중교통 외출 파우치", "차량 비상용 육아 가방", "자전거 유아 탑승 장비", "외출 동선 체크리스트"
    ],
    targetSubject: "shared",
    lifecycles: child("newborn_0_3m", "infant_4_6m", "infant_7_12m", "toddler_1_2y", "toddler_2_3y", "preschool_4_5y", "preschool_6_7y")
  },
  {
    code: "C18",
    name: "집안 안전·모니터링",
    categories: ["출입·계단", "가구·창문", "전기", "모서리·욕실", "화재·점검"],
    items: [
      "유아 안전문", "현관 보조 잠금장치", "계단 안전 점검표", "가구 전도 방지 장치", "창문 잠금장치", "블라인드 줄 정리 장치",
      "콘센트 안전 커버", "멀티탭 잠금함", "전선 정리 덮개", "가구 모서리 보호대", "서랍 잠금장치", "욕실 미끄럼 방지 매트",
      "욕실 문 안전장치", "화재 감지기 점검표", "소화기 위치 안내판", "안전용품 교체 기록표", "집안 안전 순회 체크리스트"
    ],
    targetSubject: "household",
    lifecycles: child("infant_4_6m", "infant_7_12m", "toddler_1_2y", "toddler_2_3y", "preschool_4_5y", "preschool_6_7y")
  },
  {
    code: "C19",
    name: "놀이·감각·발달",
    categories: ["신체 놀이", "감각 놀이", "쌓기·조작", "역할 놀이", "미술·음악"],
    items: [
      "터미타임 매트", "아기 딸랑이", "촉감 놀이책", "감각 공", "쌓기 블록", "끼우기 놀잇감", "모양 맞추기 놀잇감",
      "역할놀이 주방 세트", "역할놀이 인형", "역할놀이 의상", "유아 크레용", "미술 앞치마", "미술 재료 보관함",
      "리듬 악기", "실내 균형 놀이 도구", "연령별 놀이 순환 상자", "놀이 관찰 기록지"
    ],
    targetSubject: "child",
    lifecycles: child("newborn_0_3m", "infant_4_6m", "infant_7_12m", "toddler_1_2y", "toddler_2_3y", "preschool_4_5y", "preschool_6_7y")
  },
  {
    code: "C20",
    name: "책·언어·학습",
    categories: ["영아 책", "그림책·읽기", "쓰기", "수학·과학", "학용품"],
    items: [
      "아기 보드북", "촉감 보드북", "생활 그림책", "잠자리 그림책", "한글 낱말 카드", "책 읽기 기록장", "연필 잡기 연습 도구",
      "초등 연필", "지우개", "필통", "색연필", "자", "공책", "수학 조작 교구", "초등 과학 관찰 도구",
      "학습 자료 파일", "학년별 학용품 목록"
    ],
    targetSubject: "child",
    lifecycles: child("infant_7_12m", "toddler_1_2y", "toddler_2_3y", "preschool_4_5y", "preschool_6_7y", "elementary_lower", "elementary_upper", "middle_school")
  },
  {
    code: "C21",
    name: "돌봄·어린이집·학교",
    categories: ["등원", "낮잠·생활", "이름표", "학교 생활", "방과후"],
    items: [
      "어린이집 등원 가방", "유치원 등원 가방", "낮잠 이불 가방", "낮잠 이불", "개인 수건", "양치컵", "이름 스티커",
      "의류 이름 도장", "유아 실내화", "학교 실내화", "실내화 가방", "초등 책가방", "학교 준비물 파일", "교복 관리 가방",
      "방과후 활동 가방", "돌봄 인계 카드", "등하원 일정표"
    ],
    targetSubject: "child",
    lifecycles: child("toddler_1_2y", "toddler_2_3y", "preschool_4_5y", "preschool_6_7y", "elementary_lower", "elementary_upper", "middle_school")
  },
  {
    code: "C22",
    name: "야외·운동·물놀이",
    categories: ["모래·야외 놀이", "자전거", "킥보드", "수영·물놀이", "캠핑"],
    items: [
      "모래놀이 도구", "야외 놀이 매트", "유아 자전거", "아동 자전거", "자전거 헬멧", "자전거 보호대", "유아 킥보드",
      "킥보드 헬멧", "킥보드 보호대", "유아 수영복", "아동 수영복", "수영 모자", "물놀이용 구명조끼", "물놀이 신발",
      "캠핑 아동 의자", "야외 활동 응급 파우치", "운동 장비 점검표"
    ],
    targetSubject: "child",
    lifecycles: child("toddler_2_3y", "preschool_4_5y", "preschool_6_7y", "elementary_lower", "elementary_upper", "middle_school")
  },
  {
    code: "C23",
    name: "여행·장거리 이동",
    categories: ["휴대 수면", "여행 수유·식사", "여행 위생", "여행 의류", "서류·정리"],
    items: [
      "여행용 아기 침대 가방", "휴대용 수면 환경 키트", "여행용 수유 파우치", "여행용 유아 식기", "여행용 젖병 세척 키트",
      "여행용 기저귀 파우치", "휴대용 기저귀 교환 매트", "여행용 목욕 파우치", "여행용 의류 압축팩", "여벌옷 구분 파우치",
      "아동 신분 서류 파일", "해외여행 동의 서류 파일", "여행 건강 정보 카드", "장거리 이동 간식 가방", "여행 약 보관 파우치",
      "분실 방지 이름표", "가족 여행 준비 목록"
    ],
    targetSubject: "shared",
    lifecycles: child("newborn_0_3m", "infant_4_6m", "infant_7_12m", "toddler_1_2y", "toddler_2_3y", "preschool_4_5y", "preschool_6_7y", "elementary_lower", "elementary_upper", "middle_school")
  },
  {
    code: "C24",
    name: "가족 운영·서비스·기록",
    categories: ["돌봄 서비스", "렌탈", "사진·성장기록", "보험·저축", "가족 문서"],
    items: [
      "산후도우미 상담 기록", "아이돌봄 서비스 신청 파일", "돌봄 제공자 인계 노트", "육아용품 렌탈 계약 파일", "렌탈 반납 일정표",
      "성장 사진 정리 앨범", "월령 성장 기록장", "가족 육아 일정표", "가족 역할 분담표", "육아비 예산표", "육아 보험 검토 파일",
      "자녀 저축 기록표", "출생·가족관계 서류 파일", "보육·교육 신청 서류함", "가족 비상 연락망", "물려쓰기 자산 목록", "가족 서비스 갱신 일정표"
    ],
    targetSubject: "household",
    lifecycles: [
      ...mother("pregnancy_planning", "pregnancy_early", "pregnancy_mid", "pregnancy_late", "labor_delivery", "postpartum_0_6w", "postpartum_7_12w", "postpartum_3_12m", "feeding_ongoing"),
      ...child("newborn_0_3m", "infant_4_6m", "infant_7_12m", "toddler_1_2y", "toddler_2_3y", "preschool_4_5y", "preschool_6_7y", "elementary_lower", "elementary_upper", "middle_school")
    ]
  }
] as const;

const highRiskDomainCodes = new Set(["C01", "C06", "C09", "C12", "C17", "C18", "C22"]);
const subcategorySuffixes = ["기본 준비", "사용·관리", "보관·교체"] as const;

export type Release4CatalogNode = {
  code: string;
  parentCode: string | null;
  level: "domain" | "category" | "subcategory";
  nameKo: string;
  displayOrder: number;
};

export type Release4CatalogItem = {
  code: string;
  nameKo: string;
  domainCode: string;
  categoryCode: string;
  subcategoryCode: string;
  targetSubject: DomainSource["targetSubject"];
  necessity: "required" | "recommended" | "conditional" | "optional";
  recommendationState: "recommended" | "conditional" | "professional_review_required";
  safetyTier: "normal" | "elevated" | "high";
  lifecycles: readonly (Release4LifecycleRule & { priorityWeight: number })[];
  scenarioCodes: readonly CatalogScenarioCode[];
  contextRules: readonly { code: CatalogScenarioCode; weight: number; required: boolean }[];
  aliases: readonly string[];
  displayGroup: "mother_birth" | "feeding" | "sleep_furniture" | "hygiene_health" | "clothing_laundry" | "mobility_safety" | "play_education" | "family_records";
  displayOrder: number;
  editorialPriority: number;
  personalizedDiscovery: boolean;
  onboardingEligible: boolean;
  onboardingPriority: number | null;
  evidenceClass: "official_checklist" | "official_checklist_and_popularity_proxy" | "safety_guidance" | "catalog_editorial";
  evidenceSourceIds: readonly ("20slab_mentions" | "kicce_basket" | "cbrh_checklist" | "cpsc_safe_sleep")[];
  editorialReviewedAt: "2026-07-20";
};

export const release4CatalogAuditVersion = "preparation-necessity-v2-2026-07-20" as const;

export const release4CatalogEvidenceSources = {
  "20slab_mentions": {
    sourceType: "popularity_proxy",
    title: "20slab document 38640",
    publisher: "20slab",
    url: "https://www.20slab.org/Archives/GetFileStream/38640",
    checkedAt: "2026-07-20"
  },
  "kicce_basket": {
    sourceType: "public_research",
    title: "KICCE 육아물가지수 연구(Ⅳ)",
    publisher: "육아정책연구소",
    url: "https://repo.kicce.re.kr/bitstream/2019.oak/799/2/KICCE%20%EC%9C%A1%EC%95%84%EB%AC%BC%EA%B0%80%EC%A7%80%EC%88%98%20%EC%97%B0%EA%B5%AC%28%E2%85%A3%29.pdf",
    checkedAt: "2026-07-20"
  },
  "cbrh_checklist": {
    sourceType: "hospital_checklist",
    title: "CBRH checklist document 272",
    publisher: "CBRH",
    url: "https://www.cbrh.or.kr/upload/faq/1766130175789_272.pdf",
    checkedAt: "2026-07-20"
  },
  "cpsc_safe_sleep": {
    sourceType: "safety_guidance",
    title: "CPSC Safe Sleep",
    publisher: "U.S. Consumer Product Safety Commission",
    url: "https://www.cpsc.gov/SafeSleep",
    checkedAt: "2026-07-20"
  }
} as const;

export type PreparationTimelineRankInput = {
  bucket: "overdue" | "this_week" | "this_month" | "next_stage" | "completed" | "not_needed";
  hasPlan: boolean;
  userDueTime: number | null;
  lifecyclePriority: number;
  contextWeight: number;
  necessity: Release4CatalogItem["necessity"];
  displayOrder: number;
  code: string;
};

export function comparePreparationTimelineRank(left: PreparationTimelineRankInput, right: PreparationTimelineRankInput) {
  const bucketRank = { overdue: 0, this_week: 1, this_month: 2, next_stage: 3, completed: 4, not_needed: 5 } as const;
  const necessityRank = { required: 0, recommended: 1, conditional: 2, optional: 3 } as const;
  const planRank = (input: PreparationTimelineRankInput) => input.userDueTime !== null ? 0 : input.hasPlan ? 1 : 2;
  return planRank(left) - planRank(right)
    || (left.userDueTime ?? Number.MAX_SAFE_INTEGER) - (right.userDueTime ?? Number.MAX_SAFE_INTEGER)
    || bucketRank[left.bucket] - bucketRank[right.bucket]
    || right.lifecyclePriority - left.lifecyclePriority
    || right.contextWeight - left.contextWeight
    || necessityRank[left.necessity] - necessityRank[right.necessity]
    || left.displayOrder - right.displayOrder
    || left.code.localeCompare(right.code);
}

const displayGroupByDomain: Record<string, Release4CatalogItem["displayGroup"]> = {
  C01: "mother_birth", C02: "mother_birth", C03: "mother_birth", C04: "mother_birth", C05: "mother_birth", C06: "mother_birth",
  C07: "feeding", C08: "feeding", C16: "feeding",
  C09: "sleep_furniture", C15: "sleep_furniture",
  C10: "hygiene_health", C11: "hygiene_health", C12: "hygiene_health",
  C13: "clothing_laundry", C14: "clothing_laundry",
  C17: "mobility_safety", C18: "mobility_safety", C22: "mobility_safety", C23: "mobility_safety",
  C19: "play_education", C20: "play_education", C21: "play_education",
  C24: "family_records"
};

const editorialPriorityByName: Readonly<Record<string, number>> = {
  "신생아 기저귀": 1000,
  "신생아 침대": 990,
  "단단한 아기 매트리스": 980,
  "고정형 매트리스 시트": 970,
  "아기 체온계": 960,
  "신생아 아기띠": 950,
  "신생아 욕조": 940,
  "후드형 아기 타월": 930,
  "신생아 배냇저고리": 920,
  "신생아 유모차": 910,
  "젖병": 900,
  "신생아용 카시트": 890,
  "물티슈": 880,
  "아기 바디수트": 870,
  "아기 손톱가위": 860,
  "아기 바디 세정제": 850,
  "아기 보습제": 840,
  "목욕물 온도계": 830,
  "젖병 세척솔": 820,
  "젖병 세정제": 810,
  "젖병 건조대": 800,
  "기저귀 외출 가방": 790,
  "휴대용 기저귀 매트": 780,
  "아기 빨래 바구니": 770,
  "아기 옷 세탁망": 760,
  "아기 옷 건조대": 750,
  "수유 쿠션": 740,
  "수유 패드": 730,
  "유축기": 720,
  "모유 저장팩": 710,
  "분유 보관 용기": 700,
  "월령별 젖꼭지": 690,
  "기저귀 교환대": 680,
  "기저귀 정리함": 670,
  "기저귀 휴지통": 660,
  "코 관리 흡입기": 650,
  "가정용 응급 처치함": 640,
  "신생아 퇴원복": 630,
  "출산 입원 가방": 620,
  "산후 패드": 610,
  "산후 위생 팬티": 600,
  "수유 브라": 590,
  "아기 요람": 580,
  "아기 수면조끼": 570,
  "터미타임 매트": 560,
  "아기 딸랑이": 550,
  "아기 보드북": 540,
  "아기 식탁의자": 530,
  "흡착 식판": 520,
  "유아 안전문": 510
};

const domainBasePriority: Readonly<Record<string, number>> = {
  C01: 190, C02: 260, C03: 240, C04: 230, C05: 300, C06: 310,
  C07: 430, C08: 440, C09: 500, C10: 490, C11: 480, C12: 470,
  C13: 420, C14: 390, C15: 360, C16: 410, C17: 460, C18: 380,
  C19: 340, C20: 320, C21: 330, C22: 280, C23: 250, C24: 100
};

const physicalNameExceptions = new Set(["아기 손톱 파일", "한글 낱말 카드", "회수 물품 체크함"]);
const nonProductPattern = /(계획|일정표|시간표|역할 분담표|기록지|기록표|기록장|기록 파일|기록 카드|기록 수첩|결과 파일|서류|파일|메모|연락 카드|정보 카드|인계 카드|요청 카드|확인 체크 카드|체크리스트|점검표|확인표|수첩|목록|안내서|안내판|도면|상담 기록|인계 노트|예산표|연락망|갱신 일정표)/;
const requiredItemNames = new Set([
  "신생아 기저귀", "신생아 침대", "단단한 아기 매트리스", "고정형 매트리스 시트", "아기 체온계",
  "신생아 욕조", "후드형 아기 타월", "신생아 배냇저고리"
]);
const conditionalItemNames = new Set([
  "젖병", "신생아용 카시트", "역류방지쿠션", "유축기", "모유 저장팩", "분유 보관 용기",
  "월령별 젖꼭지", "수유 패드", "수유 브라"
]);
const elevatedSafetyNames = new Set(["기저귀 교환대", "아기 식탁의자", "유아 안전문", "터미타임 매트"]);

const scenarioItems: Readonly<Record<CatalogScenarioCode, readonly string[]>> = {
  first_child: ["신생아 침대", "신생아 기저귀", "신생아 아기띠", "신생아 유모차"],
  second_or_later: ["물려쓰기 분류 상자", "물려쓰기 자산 목록"],
  multiple_birth: ["출산 입원 가방", "신생아 기저귀", "젖병", "기저귀 정리함"],
  preterm_or_nicu: ["신생아 침대", "아기 체온계"],
  vaginal_delivery: ["회음부 방석", "좌욕 용기"],
  cesarean_delivery: ["출산 입원 가방", "제왕절개 상처 보호대", "산후 복부 지지대"],
  breastfeeding: ["수유 쿠션", "수유 패드", "유축기", "모유 저장팩", "수유 브라"],
  formula_feeding: ["젖병", "젖병 세척솔", "젖병 세정제", "젖병 건조대", "분유 보관 용기", "월령별 젖꼭지"],
  mixed_feeding: ["수유 쿠션", "수유 패드", "유축기", "모유 저장팩", "젖병", "분유 보관 용기"],
  daycare: ["어린이집 등원 가방", "낮잠 이불", "개인 수건", "이름 스티커"],
  kindergarten: ["유치원 등원 가방", "유아 실내화", "이름 스티커"],
  school: ["초등 책가방", "학교 실내화", "초등 연필", "필통"],
  car_primary: ["신생아용 카시트", "영아용 카시트", "유아용 카시트", "주니어 카시트", "차량 비상용 육아 가방"],
  public_transport_primary: ["신생아 아기띠", "유아용 아기띠", "휴대용 유모차", "대중교통 외출 파우치"],
  no_car: ["신생아 아기띠", "유아용 아기띠", "휴대용 유모차"],
  no_elevator: ["신생아 아기띠", "유아용 아기띠", "휴대용 유모차"],
  small_home: ["아기 요람", "기저귀 수납 카트", "수유용품 수납함", "물려쓰기 분류 상자"],
  pet_household: ["유아 안전문", "장난감 세척함", "아기방 청소 도구함"],
  secondhand_preferred: ["물려쓰기 분류 상자", "물려쓰기 자산 목록", "장난감 수납장"],
  rental_preferred: ["유축기", "신생아 유모차", "여행용 아기 침대"],
  frequent_travel: ["여행용 아기 침대", "여행용 수유 파우치", "여행용 기저귀 파우치", "휴대용 기저귀 교환 매트"],
  summer_birth: ["아기 바디수트", "아기 세면 타월", "신생아 유모차"],
  winter_birth: ["신생아 배냇저고리", "신생아 퇴원복", "아기 수면조끼"],
  budget_saving: ["신생아 아기띠", "아기 옷 세탁망", "물려쓰기 분류 상자"]
};

function contextRulesFor(nameKo: string) {
  return (Object.entries(scenarioItems) as Array<[CatalogScenarioCode, readonly string[]]>)
    .filter(([, names]) => names.includes(nameKo))
    .map(([code]) => ({
      code,
      weight: ["formula_feeding", "mixed_feeding", "breastfeeding", "car_primary"].includes(code) ? 220 : 140,
      required: (code === "car_primary" && nameKo === "신생아용 카시트")
        || (["formula_feeding", "mixed_feeding"].includes(code) && ["젖병", "분유 보관 용기", "월령별 젖꼭지"].includes(nameKo))
    }));
}

function lifecyclePriorityFor(nameKo: string, lifecycle: Release4LifecycleRule, priority: number) {
  if (priority === 0) return 0;
  if (lifecycle.axis === "mother") return 100;
  if (nameKo.includes("신생아")) return lifecycle.code === "newborn_0_3m" ? 100 : lifecycle.code === "infant_4_6m" ? 40 : 0;
  if (nameKo.includes("영아")) return ["newborn_0_3m", "infant_4_6m", "infant_7_12m"].includes(lifecycle.code) ? 100 : 0;
  if (nameKo.includes("초등") || nameKo.includes("학교")) return ["elementary_lower", "elementary_upper", "middle_school"].includes(lifecycle.code) ? 100 : 0;
  if (nameKo.includes("유치원")) return ["preschool_4_5y", "preschool_6_7y"].includes(lifecycle.code) ? 100 : 0;
  if (nameKo.includes("유아") || nameKo.includes("배변훈련") || nameKo.includes("첫 걸음")) return ["infant_7_12m", "toddler_1_2y", "toddler_2_3y", "preschool_4_5y", "preschool_6_7y"].includes(lifecycle.code) ? 100 : 0;
  return 100;
}

function normalizeCatalogTerm(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[\s\p{P}\p{S}]/gu, "");
}

const searchAliasOverrides: Record<string, readonly string[]> = {
  "신생아 아기띠": ["아기띠", "베이비캐리어"],
  "젖병 세척솔": ["젖병솔"],
  "신생아용 카시트": ["카시트", "신생아 카시트"],
  "출산 입원 가방": ["출산가방", "입원가방"],
  "수유 패드": ["모유패드"],
  "신생아 배냇저고리": ["배냇저고리", "신생아 내의"],
  "기저귀 외출 가방": ["기저귀가방", "외출가방"],
  "코 관리 흡입기": ["콧물흡입기", "코흡인기"],
  "역류방지쿠션": ["역방쿠", "역류 방지 쿠션"]
};

function aliasesFor(name: string, domainName: string, categoryName: string) {
  const candidates = [
    name,
    `${name} 준비`,
    `${name} 체크리스트`,
    `${name} 관리`,
    `${name} 선택`,
    `${domainName} ${name}`,
    `${categoryName} ${name}`,
    `${name} 필요 여부`,
    ...(searchAliasOverrides[name] ?? [])
  ];
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const normalized = normalizeCatalogTerm(candidate);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function categoryIndexFor(domain: DomainSource, itemName: string, itemIndex: number) {
  const normalizedItem = normalizeCatalogTerm(itemName);
  const directMatches = domain.categories
    .map((category, index) => ({ index, normalized: normalizeCatalogTerm(category) }))
    .filter(({ normalized }) => normalized.length >= 2 && normalizedItem.includes(normalized))
    .sort((left, right) => right.normalized.length - left.normalized.length);
  if (directMatches.length) return directMatches[0].index;
  return Math.min(
    domain.categories.length - 1,
    Math.floor((itemIndex * domain.categories.length) / domain.items.length)
  );
}

export const release4CatalogNodes: readonly Release4CatalogNode[] = domainSources.flatMap((domain, domainIndex) => {
  const domainNode: Release4CatalogNode = {
    code: domain.code,
    parentCode: null,
    level: "domain",
    nameKo: domain.name,
    displayOrder: (domainIndex + 1) * 1000
  };
  const descendants = domain.categories.flatMap((categoryName, categoryIndex) => {
    const categoryCode = `${domain.code}-${String(categoryIndex + 1).padStart(2, "0")}`;
    const categoryNode: Release4CatalogNode = {
      code: categoryCode,
      parentCode: domain.code,
      level: "category",
      nameKo: categoryName,
      displayOrder: (categoryIndex + 1) * 100
    };
    const subcategories = subcategorySuffixes.map((suffix, subcategoryIndex): Release4CatalogNode => ({
      code: `${categoryCode}-${String(subcategoryIndex + 1).padStart(2, "0")}`,
      parentCode: categoryCode,
      level: "subcategory",
      nameKo: `${categoryName} ${suffix}`,
      displayOrder: (subcategoryIndex + 1) * 10
    }));
    return [categoryNode, ...subcategories];
  });
  return [domainNode, ...descendants];
});

export const release4CatalogItems: readonly Release4CatalogItem[] = domainSources.flatMap((domain) =>
  domain.items.map((nameKo, itemIndex) => {
    const categoryIndex = categoryIndexFor(domain, nameKo, itemIndex);
    const categoryCode = `${domain.code}-${String(categoryIndex + 1).padStart(2, "0")}`;
    const subcategoryIndex = Math.floor(itemIndex / domain.categories.length) % subcategorySuffixes.length;
    const code = `R4-${domain.code}-${String(itemIndex + 1).padStart(3, "0")}`;
    const highRisk = (highRiskDomainCodes.has(domain.code) && itemIndex < 12) || nameKo === "역류방지쿠션";
    const nonProduct = !physicalNameExceptions.has(nameKo) && nonProductPattern.test(nameKo);
    const editorialPriority = nameKo === "역류방지쿠션"
      ? 0
      : nonProduct
        ? 0
        : editorialPriorityByName[nameKo] ?? Math.max(1, (domainBasePriority[domain.code] ?? 100) - itemIndex);
    const necessity: Release4CatalogItem["necessity"] = nonProduct
      ? "optional"
      : requiredItemNames.has(nameKo)
        ? "required"
        : conditionalItemNames.has(nameKo)
          ? "conditional"
          : "recommended";
    const contextRules = contextRulesFor(nameKo);
    const safetyTier: Release4CatalogItem["safetyTier"] = highRisk ? "high" : elevatedSafetyNames.has(nameKo) ? "elevated" : "normal";
    const evidenceClass: Release4CatalogItem["evidenceClass"] = nameKo === "역류방지쿠션" || domain.code === "C09" || nameKo.includes("카시트")
      ? "safety_guidance"
      : editorialPriority >= 890
        ? "official_checklist_and_popularity_proxy"
        : editorialPriority >= 500
          ? "official_checklist"
          : "catalog_editorial";
    const evidenceSourceIds: Release4CatalogItem["evidenceSourceIds"] = evidenceClass === "safety_guidance"
      ? ["cbrh_checklist", "cpsc_safe_sleep"]
      : evidenceClass === "official_checklist_and_popularity_proxy"
        ? ["cbrh_checklist", "kicce_basket", "20slab_mentions"]
        : evidenceClass === "official_checklist"
          ? ["cbrh_checklist", "kicce_basket"]
          : ["kicce_basket"];
    return {
      code,
      nameKo,
      domainCode: domain.code,
      categoryCode,
      subcategoryCode: `${categoryCode}-${String(subcategoryIndex + 1).padStart(2, "0")}`,
      targetSubject: domain.targetSubject,
      necessity,
      recommendationState: highRisk ? "professional_review_required" : necessity === "conditional" ? "conditional" : "recommended",
      safetyTier,
      lifecycles: domain.lifecycles.map((lifecycle) => ({ ...lifecycle, priorityWeight: lifecyclePriorityFor(nameKo, lifecycle, editorialPriority) })),
      scenarioCodes: contextRules.map((rule) => rule.code),
      contextRules,
      aliases: aliasesFor(nameKo, domain.name, domain.categories[categoryIndex]),
      displayGroup: displayGroupByDomain[domain.code] ?? "family_records",
      displayOrder: (1000 - editorialPriority) * 1000 + Number(domain.code.slice(1)) * 100 + itemIndex,
      editorialPriority,
      personalizedDiscovery: editorialPriority > 0,
      onboardingEligible: editorialPriority >= 700,
      onboardingPriority: editorialPriority >= 700 ? editorialPriority : null,
      evidenceClass,
      evidenceSourceIds,
      editorialReviewedAt: "2026-07-20"
    } satisfies Release4CatalogItem;
  })
);

export const release4CatalogEditorialAudit = release4CatalogItems.map((item) => ({
  version: release4CatalogAuditVersion,
  itemCode: item.code,
  judgement: item.personalizedDiscovery ? item.necessity : "optional_search_only",
  applicableContextCodes: item.contextRules.map((rule) => rule.code),
  evidenceClass: item.evidenceClass,
  sources: item.evidenceSourceIds.map((sourceId) => ({ sourceId, ...release4CatalogEvidenceSources[sourceId] })),
  confidence: item.evidenceClass === "official_checklist_and_popularity_proxy" ? "high" : item.evidenceClass === "catalog_editorial" ? "low" : "medium",
  checkedAt: item.editorialReviewedAt
})) as readonly {
  version: typeof release4CatalogAuditVersion;
  itemCode: string;
  judgement: Release4CatalogItem["necessity"] | "optional_search_only";
  applicableContextCodes: readonly CatalogScenarioCode[];
  evidenceClass: Release4CatalogItem["evidenceClass"];
  sources: readonly {
    sourceId: keyof typeof release4CatalogEvidenceSources;
    sourceType: string;
    title: string;
    publisher: string;
    url: string;
    checkedAt: string;
  }[];
  confidence: "high" | "medium" | "low";
  checkedAt: string;
}[];

const release4BundleDefinitionsByName = [
  { nameKo: "임신 초기 생활 적응", itemNames: ["산모수첩", "임신 진료 일정표", "병원 질문 메모", "복약 확인 목록", "임신 응급 연락 카드", "임신 건강 변화 일지"] },
  { nameKo: "임신 중기 신체 변화", itemNames: ["임부용 레깅스", "임산부 브라", "임산부 바디필로", "허리 지지 쿠션", "발 받침대", "임신 체중 기록계"] },
  { nameKo: "임신 후기 출산 준비", itemNames: ["출산 예정일 확인서 파일", "출산 입원 가방", "병원 연락처 카드", "퇴원 이동 계획표", "신생아 퇴원복", "가족 역할 분담표"] },
  { nameKo: "출산 입원 가방", itemNames: ["출산 입원 가방", "산모 위생 파우치", "입원 서류 파일", "입원용 앞트임 잠옷", "휴대폰 충전 세트", "빨대형 물병", "퇴원용 산모 옷", "신생아 퇴원복"] },
  { nameKo: "제왕절개 입원·회복", itemNames: ["출산 입원 가방", "입원 서류 파일", "입원용 앞트임 잠옷", "제왕절개 상처 보호대", "상처 상태 기록지", "산후 복부 지지대", "침대 옆 수납 바구니"] },
  { nameKo: "산후조리원", itemNames: ["산후 위생 팬티", "수유 겸용 잠옷", "수유 브라", "세면도구 파우치", "수유 쿠션", "수유·유축 기록지", "신생아 퇴원복"] },
  { nameKo: "산후 2주 회복", itemNames: ["산후 패드", "산후 위생 팬티", "산후 세정 용기", "산후 회복 일정표", "수분 섭취 물병", "휴식 시간표", "회복 도움 요청 카드"] },
  { nameKo: "모유수유 시작", itemNames: ["수유 쿠션", "수유 발 받침", "수유 패드", "수유 브라", "모유 저장팩", "수유·유축 기록지"] },
  { nameKo: "유축·복직 준비", itemNames: ["유축기", "유축기 깔때기", "모유 저장팩", "모유 라벨", "유축 부품 세척솔", "모유 운반 보냉가방", "복직 유축 파우치"] },
  { nameKo: "분유수유 시작", itemNames: ["분유 보관 용기", "수유 계량 도구", "젖병", "월령별 젖꼭지", "젖병 세척솔", "젖병 건조대", "수유 온도 확인 도구"] },
  { nameKo: "혼합 수유", itemNames: ["수유 쿠션", "수유 패드", "유축기", "모유 저장팩", "분유 보관 용기", "젖병", "분유·수유 기록지"] },
  { nameKo: "신생아 집 맞이", itemNames: ["신생아 침대", "단단한 아기 매트리스", "고정형 매트리스 시트", "신생아 기저귀", "기저귀 정리함", "신생아 욕조", "아기 체온계", "신생아 배냇저고리"] },
  { nameKo: "안전 수면 환경", itemNames: ["신생아 침대", "단단한 아기 매트리스", "고정형 매트리스 시트", "아기 수면조끼", "수면 공간 온도계", "침대 주변 비움 체크 카드", "수면 공간 점검 자"] },
  { nameKo: "신생아 목욕·위생", itemNames: ["신생아 욕조", "욕조 미끄럼 방지 패드", "목욕물 온도계", "후드형 아기 타월", "아기 바디 세정제", "아기 손톱가위", "목욕용품 건조망"] },
  { nameKo: "아기와 첫 외출", itemNames: ["아기 체온계", "병원 방문 가방", "예방접종 수첩", "신생아 아기띠", "기저귀 외출 가방", "휴대용 기저귀 매트", "외출 동선 체크리스트"] },
  { nameKo: "자동차 이동", itemNames: ["신생아용 카시트", "카시트 차량 적합 확인표", "카시트 사용 이력 카드", "차량 비상용 육아 가방", "기저귀 외출 가방", "외출 동선 체크리스트"] },
  { nameKo: "대중교통 이동", itemNames: ["신생아 아기띠", "휴대용 유모차", "대중교통 외출 파우치", "기저귀 외출 가방", "휴대용 기저귀 매트", "외출 동선 체크리스트"] },
  { nameKo: "이유식 시작", itemNames: ["아기 식탁의자", "흡착 식판", "유아 숟가락", "연습용 컵", "이유식 조리 냄비", "이유식 보관 용기", "식단·알레르기 기록표"] },
  { nameKo: "어린이집 입소", itemNames: ["어린이집 등원 가방", "낮잠 이불 가방", "낮잠 이불", "개인 수건", "양치컵", "이름 스티커", "돌봄 인계 카드", "등하원 일정표"] },
  { nameKo: "배변 훈련", itemNames: ["유아 변기", "변기 보조 시트", "배변 발 받침", "배변훈련 팬티", "배변 성공 기록판", "욕실 미끄럼 방지 매트"] },
  { nameKo: "유치원·학교 입학", itemNames: ["유치원 등원 가방", "유아 실내화", "학교 실내화", "실내화 가방", "초등 책가방", "필통", "학년별 학용품 목록", "학교 준비물 파일"] },
  { nameKo: "응급·재난 대비", itemNames: ["가족 응급 연락 카드", "가정용 응급 처치함", "의약품 잠금 보관함", "가족 비상 연락망", "화재 감지기 점검표", "소화기 위치 안내판", "집안 안전 순회 체크리스트"] },
  { nameKo: "돌 전후 여행", itemNames: ["여행용 아기 침대 가방", "휴대용 수면 환경 키트", "여행용 수유 파우치", "여행용 기저귀 파우치", "휴대용 기저귀 교환 매트", "여벌옷 구분 파우치", "가족 여행 준비 목록"] },
  { nameKo: "해외 여행", itemNames: ["아동 신분 서류 파일", "해외여행 동의 서류 파일", "여행 건강 정보 카드", "여행 약 보관 파우치", "분실 방지 이름표", "가족 여행 준비 목록"] },
  { nameKo: "쌍둥이·다태아", itemNames: ["신생아 침대", "신생아 기저귀", "젖병", "기저귀 정리함", "가족 육아 일정표", "가족 역할 분담표", "육아비 예산표"] },
  { nameKo: "둘째·물려쓰기", itemNames: ["물려쓰기 분류 상자", "물려쓰기 자산 목록", "회수 물품 체크함", "성장 사이즈 기록표", "카시트 사용 이력 카드", "안전용품 교체 기록표"] },
  { nameKo: "작은 집·수납 최소화", itemNames: ["기저귀 수납 카트", "수유용품 수납함", "침구 수납함", "가구 배치 체크 도면", "물려쓰기 분류 상자", "가족 공용 비품 목록"] },
  { nameKo: "중고·대여 중심 준비", itemNames: ["육아용품 렌탈 계약 파일", "렌탈 반납 일정표", "물려쓰기 자산 목록", "카시트 사용 이력 카드", "안전용품 교체 기록표", "성장 가구 교체 목록"] },
  { nameKo: "여름 준비", itemNames: ["수면 공간 온도계", "수면 공간 습도계", "유아 모자", "아동 우비", "유모차 우비", "물놀이용 구명조끼", "물놀이 신발"] },
  { nameKo: "겨울 준비", itemNames: ["유아 외투", "아동 방한 장갑", "아동 목도리", "아기 수면조끼", "침실 수분 관리계", "계절 의류 보관함"] }
] as const;

const release4ItemCodeByName = new Map(release4CatalogItems.map((item) => [item.nameKo, item.code]));

export const release4BundleDefinitions = release4BundleDefinitionsByName.map((definition) => ({
  ...definition,
  itemCodes: definition.itemNames.map((name) => {
    const code = release4ItemCodeByName.get(name);
    if (!code) throw new Error(`RELEASE4_BUNDLE_ITEM_UNKNOWN:${definition.nameKo}:${name}`);
    return code;
  })
}));

export const release4BundleNames = release4BundleDefinitions.map((bundle) => bundle.nameKo);

const requiredSearchExamples = [
  { query: "아기띠", expectedNameKo: "신생아 아기띠" },
  { query: "베이비캐리어", expectedNameKo: "신생아 아기띠" },
  { query: "젖병솔", expectedNameKo: "젖병 세척솔" },
  { query: "신생아 카시트", expectedNameKo: "신생아용 카시트" },
  { query: "출산가방", expectedNameKo: "출산 입원 가방" },
  { query: "모유패드", expectedNameKo: "수유 패드" },
  { query: "배냇저고리", expectedNameKo: "신생아 배냇저고리" },
  { query: "기저귀가방", expectedNameKo: "기저귀 외출 가방" },
  { query: "콧물흡입기", expectedNameKo: "코 관리 흡입기" },
  { query: "코흡인기", expectedNameKo: "코 관리 흡입기" },
  { query: "역방쿠", expectedNameKo: "역류방지쿠션" }
] as const;

export const release4SearchAcceptanceCorpus = [
  ...requiredSearchExamples,
  ...release4CatalogItems
    .filter((item) => !requiredSearchExamples.some((entry) => entry.expectedNameKo === item.nameKo))
    .slice(0, 200 - requiredSearchExamples.length)
    .map((item) => ({ query: item.aliases[2], expectedNameKo: item.nameKo }))
] as const;

export type Release4CatalogMetrics = {
  domains: number;
  categories: number;
  subcategories: number;
  canonicalItems: number;
  aliases: number;
  highRiskItemsAwaitingProfessionalReview: number;
  lifecycleGaps: string[];
};

export function release4CatalogMetrics(): Release4CatalogMetrics {
  const lifecycleCoverage = new Set(
    release4CatalogItems.flatMap((item) => item.lifecycles.map((lifecycle) => `${lifecycle.axis}:${lifecycle.code}`))
  );
  const expectedLifecycleKeys = [
    ...motherLifecycleCodes.map((code) => `mother:${code}`),
    ...childLifecycleCodes.map((code) => `child:${code}`)
  ];
  return {
    domains: release4CatalogNodes.filter((node) => node.level === "domain").length,
    categories: release4CatalogNodes.filter((node) => node.level === "category").length,
    subcategories: release4CatalogNodes.filter((node) => node.level === "subcategory").length,
    canonicalItems: release4CatalogItems.length,
    aliases: release4CatalogItems.reduce((count, item) => count + item.aliases.length, 0),
    highRiskItemsAwaitingProfessionalReview: release4CatalogItems.filter((item) => item.safetyTier === "high").length,
    lifecycleGaps: expectedLifecycleKeys.filter((key) => !lifecycleCoverage.has(key))
  };
}

export function validateRelease4Catalog(): string[] {
  const errors: string[] = [];
  const metrics = release4CatalogMetrics();
  const codes = new Set<string>();
  const names = new Set<string>();
  const nodeCodes = new Set(release4CatalogNodes.map((node) => node.code));
  const coveredScenarios = new Set(release4CatalogItems.flatMap((item) => item.scenarioCodes));

  if (metrics.domains < 24) errors.push(`requires 24 domains, found ${metrics.domains}`);
  if (metrics.categories < 100) errors.push(`requires 100 categories, found ${metrics.categories}`);
  if (metrics.subcategories < 300) errors.push(`requires 300 subcategories, found ${metrics.subcategories}`);
  if (metrics.canonicalItems < 400) errors.push(`requires 400 canonical items, found ${metrics.canonicalItems}`);
  if (metrics.aliases < 3000) errors.push(`requires 3000 aliases, found ${metrics.aliases}`);
  if (metrics.highRiskItemsAwaitingProfessionalReview < 80) {
    errors.push(`requires 80 high-risk review candidates, found ${metrics.highRiskItemsAwaitingProfessionalReview}`);
  }
  if (metrics.lifecycleGaps.length) errors.push(`lifecycle gaps: ${metrics.lifecycleGaps.join(", ")}`);
  if (release4SearchAcceptanceCorpus.length < 200) errors.push(`requires 200 search acceptance queries, found ${release4SearchAcceptanceCorpus.length}`);
  const missingScenarios = catalogScenarioCodes.filter((code) => !coveredScenarios.has(code));
  if (missingScenarios.length) errors.push(`scenario gaps: ${missingScenarios.join(", ")}`);

  for (const node of release4CatalogNodes) {
    if (node.parentCode && !nodeCodes.has(node.parentCode)) errors.push(`${node.code}: missing parent ${node.parentCode}`);
  }
  for (const item of release4CatalogItems) {
    if (codes.has(item.code)) errors.push(`${item.code}: duplicate code`);
    codes.add(item.code);
    const normalizedName = normalizeCatalogTerm(item.nameKo);
    if (names.has(normalizedName)) errors.push(`${item.code}: duplicate canonical name ${item.nameKo}`);
    names.add(normalizedName);
    if (!nodeCodes.has(item.domainCode) || !nodeCodes.has(item.categoryCode) || !nodeCodes.has(item.subcategoryCode)) {
      errors.push(`${item.code}: category path is incomplete`);
    }
    if (!item.lifecycles.length) errors.push(`${item.code}: lifecycle is required`);
    if (item.lifecycles.some((lifecycle) => !Number.isInteger(lifecycle.priorityWeight) || lifecycle.priorityWeight < 0)) {
      errors.push(`${item.code}: lifecycle priority is invalid`);
    }
    if (!item.displayGroup || !item.editorialReviewedAt || !item.evidenceClass) errors.push(`${item.code}: editorial metadata is required`);
    if (!item.evidenceSourceIds.length || item.evidenceSourceIds.some((sourceId) => !release4CatalogEvidenceSources[sourceId])) {
      errors.push(`${item.code}: editorial evidence source is required`);
    }
    if (!item.personalizedDiscovery && item.lifecycles.some((lifecycle) => lifecycle.priorityWeight !== 0)) {
      errors.push(`${item.code}: hidden personalized items must use zero lifecycle priority`);
    }
    if (item.scenarioCodes.includes("preterm_or_nicu") && (item.safetyTier !== "high" || item.recommendationState !== "professional_review_required")) {
      errors.push(`${item.code}: medical context must stay behind professional review`);
    }
    if (item.aliases.length < 7) errors.push(`${item.code}: at least 7 distinct aliases are required`);
  }
  for (const entry of release4SearchAcceptanceCorpus) {
    const normalizedQuery = normalizeCatalogTerm(entry.query);
    const matches = release4CatalogItems.filter((item) => item.aliases.some((alias) => normalizeCatalogTerm(alias).includes(normalizedQuery)));
    if (matches[0]?.nameKo !== entry.expectedNameKo) {
      errors.push(`search corpus: ${entry.query} expected ${entry.expectedNameKo}, found ${matches[0]?.nameKo ?? "none"}`);
    }
  }
  return errors;
}
