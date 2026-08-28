# c20deeb 시각 스펙 노트 (DSN-053 — P1·P2 실행 참조)

> 생성: 라운드 53. `git show c20deeb:<path>`로 추출한 승인 디자인 스펙.
> 실행 에이전트는 이 문서의 파일:라인 인용을 따라 원본을 직접 읽을 것.
> 전체 상세는 세션 추출 노트 기준이며, 아래는 핵심 요약 + 원본 파일 색인이다.

## 구조적 사실 3가지
1. **승인 캡처는 픽셀 락 분기 렌더**다(HOME-001=PixelHomeScreen 등). 홈 복원 = "픽셀 분기 문법을 세션 렌더로 승격". 더보기·가족·리포트·상세는 c20deeb에서 세션/픽셀 공용 트리라 그대로 옮긴다.
2. 시각 언어의 본체는 c20deeb `src/design-system/`(tokens 7 + components 11 + responsive + compact-korean-label)과 `src/preparation/`(PreparationListParity 420줄, preparation-grouping, item-visuals) — **현재 트리에 없음. 통째 이식 대상.**
3. 브랜딩 자산은 P0로 이미 동일(해시 대조). 잔여: `pixel-splash-mark.png` 이식, `growth_logo.png` 처리(c20deeb에선 logo_mark와 동일 바이트), 금액 "38,500원" 표기.

## 아이콘 계열
c20deeb는 `@expo/vector-icons` **MaterialCommunityIcons**(같은 패키지 — 신규 의존성 0). 이식 컴포넌트·매핑 테이블(item-visuals 41승인+32키워드+C01~C24, 그룹 10종, 상태 8종)은 MCI 이름 기준 — **MCI 그대로 사용**(재매핑 금지).

## 토큰 롤백 표 (theme.ts — c20deeb 값으로)
coral 50~700: #FFF4EF #FFE4D8 #FFC8B5 #FFA58A #F98060 #E85F3B #C94627 #A93720 (+800 #862D1D, 900 #67251B 추가)
cream.bg #FFFDFC · surfaceAlt #F8F6F4 / text #211E1C #5F5854 #7A716B / success #16794B warning #B45309 danger #B42318 info #1D4ED8
mainCoral=coral[600] · subCoral=coral[500] · gray900=text.primary · gray300 #E5DFDB · primary500=coral[600] · primary100=coral[100] · secondary500 #267A68 · **touchTarget 48**
presentation 10서피스: dangerSurface #FFF0ED segmentedTrack #F5F0EA chartPlot #FFF4EE splashStageSurface #FFF9F4 importCanvas #FFFCFA previewCoral #FFF0EA previewYellow #FFF5D7 previewGreen #EAF7F2 previewPeach #FFECE6 previewNeutral #ECECEC
brandIdentity: canvas #FFF9F3 navy #17324D persimmon #FF6B4A butter #FFD76A
불변: spacing(24/12/16/20)·radii(12/999/20/22/28)·typography·money 3티어·shadows.card·ctaHeight 56·categoryPalette 10색

## design-system tokens (신규 이식)
semanticColors(color.ts:1-32): surface #FFF surfaceMuted #F8F6F4 border #E5DFDB textPrimary #211E1C brandPrimary/actionPrimary #C94627 brandSecondary #267A68 actionSecondary #FFF4EF successSurface #ECF8F1 warningSurface #FFF7E8 dangerSurface #FFF0EE infoSurface #EFF5FF reviewSurface #F5F0FF success #16794B warning #B45309 danger #B42318 info #1D4ED8 review #7C3AED overlay rgba(33,30,28,.48)
chartColors ["#C94627","#267A68","#2F6FED","#B45309","#7C3AED","#7A716B"]
spacing none0 xxs4 xs8 sm12 md16 lg20 xl24 xxl32 xxxl40 huge48 section64 / radius small8 medium12 large16 card20 sheet28 pill999 (theme.radii.card 22와 이중 스케일 — 공존 유지)
typography display32/40 h1 28/36 h2 24/32 h3 20/28 title18/26 bodyLarge17/26 body15/22 bodyStrong15/22/700 caption12/18 label14/20/600 amountLarge32/38 amountMedium24/30 amountRegular18/24 (amount는 tabular)
elevation card{1,(0,1),.08,3} overlay{8,(0,12),.16,32} / icon small16 medium22 large28 hero40

## 상태 pill (ModV1Primitives:100-141) — 정본 문구
researching=알아보기(surfaceMuted/textSecondary) · planned/ordered/gift_expected=예정/주문/선물 예정(infoSurface/info) · owned=보유·gifted=선물(successSurface/success) · borrowed/rented=대여(reviewSurface/review) · replacement_*=교체(warningSurface/warning) · not_needed=필요 없음 등(surfaceMuted). pill: radius pill·minH 24·padH 8·padV 4·font 10/700
가족 pill: owner=관리자(warning) co_parent=기록 가능 viewer=보기 전용 그외=선물 참여 — StatusBadge(padH 12 padV 4 font 12/800)

## 화면 요약 (원본 정독 필수 — 색인 참조)
- **홈(HOME-001)**: 배경 coral[50] 풀블리드(margin -24/padding 24). ① 헤더(account-child-circle 34 + 닉네임 17/800 + stage 11 + "아이 전환⌄") ② 히어로(bg subCoral·radius 22·padding 16·"이번 달 우리 아이 비용" 12/700·금액 27/800·"예산 N 중"+"27%"·트랙 coral[200] h8 채움 white) ③ "자주 기록해요" 칩 4개(white·border gray300·pill·minH 48·11/700) ④ 준비 현황 카드(package-variant-closed 21·"이번 주 준비 현황" 15/800·CTA subCoral radius 12 minH 52 "지금 필요한 준비템 보기") ⑤ 최근 기록(헤더 16/800+"전체 보기" 12/700, ListRow). 세션 상한: 1히어로+3구획(+구매 확인 카드는 일시적 예외).
- **준비템(ITEM-001)**: TopAppBar(준비 홈/내 준비 목록) → 진행률 히어로(bg actionPrimary·radius 16·padding 18·"나의 준비 진행률"·"N개 중 M개 완료"·바 h9·접기 chevron) → 세그먼트(분류별/시기별, 트랙 #F8F6F4 radius14/선택 white radius11 minH48) → 검색(품목명·별칭·분류 검색·버튼 48 actionPrimary) → 분류 섹션 카드(radius16·헤더 minH68·원 40 tint·"위생·목욕"+"2/6 보유"·바 #F5E8DF h5 채움 #267A68·펼침 타일 그리드+더 보기 5→10→20→40) → 누락 신고. 타일: 148h·radius16·원 44 pill·이름 12/700 2줄 균형(compact-korean-label)·상태 pill. 그룹 10종/시기 밴드 4종/그룹핑·아이콘 로직은 preparation-* 파일 그대로. 5개 미만 그룹 비노출.
- **상세(ITEM-002)**: 플로팅 back/share(34·rgba255,.82) → 히어로 이미지 카드(beige·h215·radius22·marginTop -4) → 정보 카드(이름 21/800·"예상 가격대" 12/700·가격대 26/800·탭행 "가격 비교"(활성 2px 밑줄)/"제품 정보"·판매처 행 [이름13/700+캡션11 / 가격 13/800 / 구매하기 coral[400] minW72]) → 고지(CTA 바로 위)+["관심에 저장","바로 구매하기"] → 설명 카드 3~4장(왜 필요해요?/안 사도 돼요/중고?/안전) . 현재 실가격+확인시각은 "무료배송" 캡션 슬롯에 유지.
- **지출(EXP-001)**: 헤더(지출 기록 19/800+부제 11) → 날짜 pill(어제/오늘/내일 flex1+달력 48) → "바로 기록" 타일(144h·radius16·파스텔 원 44 peach→선택 mainCoral·선택 테두리 mainCoral 2px·라벨 12/800) → "분류별 빠른 품목" 아코디언(radius16·헤더 minH68·원 42 categoryColors·6개 기본) → 고정 푸터(분류 11/700 → 품목명 15/800+연필 18 → 금액박스 beige radius14 22/800+"원" 14/800 → 저장). **"38,500원" 표기(₩ 금지)**.
- **리포트(REP-001)**: 세그먼트(월/분기/연간) → 월 내비(화살 48/size28·라벨 18/800) → LineChartCard(값 28/800·플롯 #FFF4EE h104) → DonutChartCard(도넛 96·border16·rotate -22deg·범례 %) → 절약 팁 카드(bg peach·18/800) → 누적 카드(bg peach). 세션 추가 구획은 뒤로/접기.
- **더보기(SET-001)**: 제목 "프로필" → 가구 카드(로고 원 56+logo_mark 38·"{nickname}네" 18/800·"보호자 N명 · 아이 M명"·stage pill) → 섹션 4(아이·산모/가족/예산·데이터/설정, 제목 13/700+그룹 박스 radius22, 행 minH64·원 40 coral[50]/coral[700]·chevron).
- **가족(FAM-001)**: 헤더(가족과 함께 22/800) → 아바타 스택(36·겹침 -8·[peach,mint,sky,beige])+`+`(48) → 가족계정 카드 → 초대하기 그룹 2행(링크로 초대/초대 코드 공유) → 멤버 관리(행 radius16·pill 관리자/기록 가능/보기 전용) → "가족 초대하기"(h52). 대기 초대는 멤버 행(pending)으로 흡수.
- **런치(SPL-001)**: 로고 컨테이너(radius22·72)+splash-mark(104 contain)·픽셀 락은 pixel-splash-mark·타이틀 brandNavy(#17324D)·태그라인 2줄·스테이지 프레임(#FFF9F4·radius32·264)·페이저 brandNavy.

## 통합 지점 (현재 기능 → c20deeb 문법)
찜 칩=히어로/세그먼트 사이 1줄 · 오프라인 대기=상태 pill 자리(warningSurface)/hint 슬롯 · 아이 전환=헤더 onPress→현재 시트 · 필수도/출산전=시기별 보조 칩 격하 · 알림 벨=헤더 우측 슬롯 · SyncStatusBar=각 화면 최하단 · 구매확인 카드=히어로 위 예외 · 대기 초대=멤버 행 흡수 · 리포트 세션 확장 구획=캡처 6구획 뒤 배치/접기.

## P1 순서
① MCI 채택(신규 의존성 0) ② theme 토큰 롤백+presentation/brandIdentity/touchTarget48 ③ design-system 최소셋 이식 ④ src/ui 4종(StageBadge/ListRow/MoneyText+formatKrwParts/EmptyState) ⑤ src/preparation 3파일 ⑥ ui.tsx 6컴포넌트 수치 대조(SegmentedControl/HeroSummaryCard/ProductComparisonRow/FamilyAvatarGroup/LineChartCard/DonutChartCard) ⑦ pixel-splash-mark 이식·growth_logo 판정.

## 원본 파일 색인 (git show c20deeb:<path>)
app/pixel-lock.tsx:11-27 · app/(tabs)/index.tsx(픽셀 103-215/세션 353-445) · app/(tabs)/items.tsx:14-68 · app/(tabs)/reports.tsx(68-259/475-793/800-850) · app/(tabs)/more.tsx:48-204 · app/items/[itemTemplateId].tsx(28-102/104-143/149-407) · app/expenses/new.tsx(52-212/695-855/856-1145) · app/family/index.tsx(25-60/282-413/415-566) · app/launch-animation.tsx(12-42/133-207) · src/theme.ts · src/ui.tsx(196-660/660-895) · src/ui/* · src/design-system/** · src/preparation/** · src/pixelLock/styles/*
