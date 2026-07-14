import { Redirect } from "expo-router";
import { Text, View } from "react-native";
import { theme } from "../src/theme";
import { AppScreen, Card, ScreenHeader } from "../src/ui";

const stageCoverage = [
  ["임신 초기", 15],
  ["임신 중기", 18],
  ["임신 후기", 25],
  ["신생아 0-3개월", 28],
  ["영아 4-6개월", 24],
  ["영아 7-12개월", 27],
  ["유아 1-3세", 27],
  ["유아 4-7세", 21],
  ["초등학생", 18],
  ["중학생", 16]
] as const;

export default function CatalogCoverageEvidenceScreen() {
  if (process.env.EXPO_PUBLIC_PIXEL_LOCK !== "1") return <Redirect href="/" />;

  return (
    <AppScreen>
      <View accessibilityLabel="ITEM-COVERAGE-001" testID="screen-ITEM-COVERAGE-001" style={{ gap: 14 }}>
        <ScreenHeader
          eyebrow="ITEM-COVERAGE-001"
          title="카탈로그 커버리지"
          subtitle="Sprint 2 옵션 A · 검토 완료 데이터의 설치 앱 증적"
        />
        <Card style={{ gap: 8 }}>
          <Text style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>게시 가드 통과</Text>
          <Text style={{ color: theme.colors.gray600, fontSize: 13 }}>고유 상품 160개 · 구매 가능 상품 58개</Text>
          <Text style={{ color: theme.colors.gray600, fontSize: 13 }}>활성 링크 98개 · 핵심 40개 모두 2개 이상</Text>
          <Text style={{ color: theme.colors.gray600, fontSize: 13 }}>필수품 링크 커버리지 21/51 (41.2%)</Text>
        </Card>
        <Card style={{ gap: 7 }}>
          <Text style={{ color: theme.colors.brown, fontSize: 15, fontWeight: "800" }}>단계별 검토·활성 상품</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {stageCoverage.map(([label, count]) => (
              <View
                key={label}
                style={{
                  backgroundColor: theme.colors.beige,
                  borderRadius: theme.radii.small,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  width: "48%"
                }}
              >
                <Text style={{ color: theme.colors.gray600, fontSize: 11 }}>{label}</Text>
                <Text style={{ color: theme.colors.brown, fontSize: 14, fontWeight: "800" }}>{count}개</Text>
              </View>
            ))}
          </View>
        </Card>
      </View>
    </AppScreen>
  );
}
