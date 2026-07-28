import { LegalPlaceholderNotice, PublicPage } from "../../src/components/PublicPage";

export default function TermsPage() {
  return <PublicPage title="서비스 이용약관"><LegalPlaceholderNotice /><p>승인된 약관 버전과 무결성 hash는 서버의 법적 문서 API와 사용자 동의 이벤트에 함께 기록됩니다.</p></PublicPage>;
}
