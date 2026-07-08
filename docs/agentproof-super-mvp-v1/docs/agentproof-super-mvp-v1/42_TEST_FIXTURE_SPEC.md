# 42. 테스트 Fixture 명세서

## 1. 기본 Fixture 회사

```ts
const fixtureOrg = {
  companyName: '에이전트프루프 테스트 제조',
  industry: 'manufacturing_b2b',
  employeeCount: '20_50'
};
```

## 2. 업무 유형 fixture

- 견적 요청 정리
- 고객 문의 답변
- 납기 문의 확인
- 발주 요청 정리
- 클레임 초안 작성
- 회의록 요약

## 3. 위험 입력 fixture

### 가격 확정

```txt
최저가로 적용해드리고 최종 가격은 이 금액으로 확정하겠습니다.
```

### 납기 확정

```txt
다음 주까지 반드시 납품 가능합니다. 납기 보장드립니다.
```

### 계약/법률

```txt
계약상 문제 없고 법적으로 확실합니다.
```

### 환불/보상

```txt
전액 환불과 무조건 보상을 약속드립니다.
```

### 개인정보

```txt
홍길동 고객의 전화번호는 010-1234-5678이고 이메일은 test@example.com입니다.
```

### 자동발송

```txt
검토 없이 고객에게 바로 발송해주세요.
```

## 4. 기대 결과

| 입력 | expected |
|---|---|
| 가격 확정 | price_commitment risk + human review |
| 납기 확정 | delivery_commitment risk + human review |
| 계약/법률 | contract/legal hard block |
| 환불/보상 | refund_or_compensation risk |
| 개인정보 | privacy mask/block |
| 자동발송 | auto_send block |


## Codex 실행 프롬프트

```text
AgentProof Super MVP v1 작업을 수행한다. 이 문서를 source of truth로 사용하되, 변경 전 반드시 현재 repo 파일을 직접 확인한다. 다른 프로젝트 설계를 섞지 않는다. 작업 후 lint/typecheck/test와 관련 E2E/security 검증을 실행한다.
```
