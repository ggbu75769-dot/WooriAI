import { LegalPlaceholderNotice, PublicPage } from "../../src/components/PublicPage";

export default function PrivacyPage() {
  return <PublicPage title="개인정보처리방침"><LegalPlaceholderNotice /><p>현재 앱의 설정에서 동의 내역, 데이터 내보내기, 계정 삭제 절차를 확인할 수 있습니다.</p></PublicPage>;
}
