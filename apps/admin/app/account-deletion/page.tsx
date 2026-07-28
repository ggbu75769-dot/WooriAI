import { PublicPage } from "../../src/components/PublicPage";

export default function AccountDeletionPage() {
  return (
    <PublicPage title="계정 삭제 요청">
      <p>앱의 더보기 → 개인정보 설정 → 계정 삭제에서 본인 인증 후 요청할 수 있습니다.</p>
      <p>가족 소유자는 먼저 활성 공동 양육자에게 소유권을 이전하거나, 단독 가족을 삭제해야 합니다. 요청이 접수되면 세션과 기기 토큰이 즉시 폐기되고 처리 상태를 확인할 수 있는 별도 토큰이 발급됩니다.</p>
      <p>앱에 접근할 수 없다면 <a href="mailto:support@wooriai.app">support@wooriai.app</a>으로 문의해 주세요.</p>
    </PublicPage>
  );
}
