# 12. 브랜딩/디자인 시스템

## 1. 브랜드 핵심

AgentProof는 “AI를 잘 만든다”가 아니라 “AI 업무가 안전하게 돌아가는지 증명한다”는 브랜드다.

### 키워드

- Proof: 근거, 기록, 숫자, 검증
- Work: 실제 업무, 반복 업무, 실무 언어
- Safe: 사람 확인, 마스킹, 차단
- Simple: 질문 줄이기, 클릭 줄이기
- Decision: 대표/팀장의 판단

## 2. 브랜드 카피

```txt
AI 도입 여부를 감으로 정하지 마세요.
10일 동안 실제 업무로 증명하세요.
```

```txt
붙여넣으면 결과 카드가 나오고,
10일이 지나면 운영 판단표가 남습니다.
```

## 3. Tone & Manner

| 지양 | 지향 |
|---|---|
| AI 혁신, 자동화, 무한 가능성 | 실제 업무, 10일, 50건, 숫자 |
| 위험합니다 | 사람 확인이 필요합니다 |
| 실패했습니다 | 재검증이 필요합니다 |
| 케이스 | 업무 |
| 피드백 | 사용 여부 |
| 워크스페이스 | 파일럿 보드 |

## 4. 컬러 토큰

```css
:root {
  --ap-ink: #101828;
  --ap-navy: #071b3d;
  --ap-blue: #0b5cff;
  --ap-blue-soft: #e8f1ff;
  --ap-mint: #11d5c2;
  --ap-green: #18b26b;
  --ap-green-soft: #eaf8f0;
  --ap-amber: #ff9f1c;
  --ap-amber-soft: #fff4df;
  --ap-red: #f04438;
  --ap-red-soft: #fff0ef;
  --ap-cream: #f7f4ed;
  --ap-surface: #ffffff;
  --ap-line: #e6e9ef;
  --ap-muted: #667085;
}
```

## 5. Typography

- H1: 48~64px desktop, 34~40px mobile
- H2: 32~40px
- Metric number: 36~56px
- Card title: 18~22px
- Body: 15~17px
- Caption: 12~13px

## 6. Layout

- 최대 폭: landing 1180px, app 1280px
- 카드 radius: 20~28px
- 버튼 height: 44~56px
- Shadow: 매우 약하게
- Background: cream/white, dashboard는 light blue tint 가능

## 7. Motion

- 숫자 카드는 0.2~0.4초 fade/slide
- 과한 3D/blur 금지
- skeleton은 부드럽게
- CTA hover는 scale보다 background/outline 변화

## 8. Visual rule

모든 핵심 화면 상단에는 항상 숫자가 있다.

```txt
[Proof Score] [처리] [사용률] [절감] [위험] [신뢰도]
```


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
