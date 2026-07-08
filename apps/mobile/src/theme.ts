export const theme = {
  colors: {
    mainCoral: "#FF6B52",
    subCoral: "#FF8E72",
    peach: "#FFE4D6",
    mint: "#E8F6F1",
    sky: "#E8F1FF",
    brown: "#4A3F35",
    gray900: "#1F1F1F",
    gray600: "#666666",
    gray300: "#E5E5E5",
    beige: "#FFF7ED",
    white: "#FFFFFF",
    primary500: "#FF8A7A",
    primary100: "#FFE6E0",
    secondary500: "#7DDCC7",
    background: "#FFF8F1",
    surface: "#FFFFFF",
    textPrimary: "#242424",
    textSecondary: "#7A7A7A",
    success: "#3DBE7E",
    warning: "#FFB020",
    danger: "#EF4444"
  },
  spacing: {
    screen: 24,
    gap: 12,
    card: 16,
    section: 20
  },
  radii: {
    small: 12,
    pill: 999,
    button: 20,
    card: 22,
    sheet: 28
  },
  typography: {
    headline1: { fontSize: 28, lineHeight: 36, fontWeight: "700" },
    headline2: { fontSize: 22, lineHeight: 30, fontWeight: "700" },
    headline3: { fontSize: 18, lineHeight: 26, fontWeight: "600" },
    body1: { fontSize: 15, lineHeight: 22, fontWeight: "400" },
    body2: { fontSize: 13, lineHeight: 20, fontWeight: "400" },
    caption: { fontSize: 11, lineHeight: 16, fontWeight: "400" }
  },
  shadows: {
    card:
      typeof document !== "undefined"
        ? {
            boxShadow: "0px 8px 18px rgba(74, 63, 53, 0.08)"
          }
        : {
            shadowColor: "#4A3F35",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.08,
            shadowRadius: 18,
            elevation: 2
          }
  },
  touchTarget: 44,
  ctaHeight: 56
} as const;
