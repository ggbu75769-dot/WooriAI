import { PublicPage } from "../../src/components/PublicPage";

export default function DataExportPage() {
  return (
    <PublicPage title="데이터 내보내기 안내">
      <p>앱의 개인정보 설정에서 다시 인증한 뒤 내보내기를 요청할 수 있습니다. 중복 요청은 하나의 작업으로 처리되며 완료된 파일은 제한된 기간에만 내려받을 수 있습니다.</p>
      <p>내보내기 범위에는 사용자·아이 프로필, 지출, 예산, 준비템 상태, 가족 구성원, 동의 및 가져오기 이력이 포함됩니다.</p>
    </PublicPage>
  );
}
