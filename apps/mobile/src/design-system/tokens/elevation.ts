// 그림자 잉크는 design-system 토큰 대장의 **정의 자리**다 — 라운드 104 TK4(색 리터럴
// 토큰화 4차)가 앱 소스를 전수로 훑고 여기 두 줄을 옮기지 않은 이유가 그것이다: 화면이
// 부르는 이름이 아니라 이름이 가리키는 값 자신이라 더 위로 끌어올릴 곳이 없다. 값(#211E1C)이
// semanticColors.textPrimary와 우연히 같지만 뜻이 다르므로(그림자 잉크 ≠ 본문 잉크) 그쪽을
// 참조로 부르지 않는다 — 한쪽 팔레트 개정이 다른 쪽을 조용히 끌고 가게 된다.
export const elevation = {
  flat: { elevation: 0, shadowOpacity: 0 },
  card: {
    elevation: 1,
    shadowColor: "#211E1C",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3
  },
  overlay: {
    elevation: 8,
    shadowColor: "#211E1C",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 32
  }
} as const;
