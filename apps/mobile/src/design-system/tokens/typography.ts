import type { TextStyle } from "react-native";

export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: "700" },
  heading1: { fontSize: 28, lineHeight: 36, fontWeight: "700" },
  heading2: { fontSize: 24, lineHeight: 32, fontWeight: "700" },
  heading3: { fontSize: 20, lineHeight: 28, fontWeight: "700" },
  title: { fontSize: 18, lineHeight: 26, fontWeight: "700" },
  bodyLarge: { fontSize: 17, lineHeight: 26, fontWeight: "400" },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: "700" },
  caption: { fontSize: 12, lineHeight: 18, fontWeight: "400" },
  label: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  amountLarge: { fontSize: 32, lineHeight: 38, fontWeight: "700", fontVariant: ["tabular-nums"] },
  amountMedium: { fontSize: 24, lineHeight: 30, fontWeight: "700", fontVariant: ["tabular-nums"] },
  amountRegular: { fontSize: 18, lineHeight: 24, fontWeight: "700", fontVariant: ["tabular-nums"] }
} satisfies Record<string, TextStyle>;
