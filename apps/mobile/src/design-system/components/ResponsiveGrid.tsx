import { Children, type PropsWithChildren } from "react";
import { View, useWindowDimensions } from "react-native";
import { breakpoints } from "../tokens/breakpoint";
import { spacing } from "../tokens/spacing";

export function ResponsiveGrid({ children, minColumnWidth = 260 }: PropsWithChildren<{ minColumnWidth?: number }>) {
  const { width } = useWindowDimensions();
  const columns = width >= breakpoints.mediumMax ? 3 : width > breakpoints.compactMax ? 2 : 1;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
      {Children.map(children, (child) => (
        <View style={{ flexBasis: columns === 1 ? "100%" : minColumnWidth, flexGrow: 1, minWidth: columns === 1 ? 0 : minColumnWidth }}>
          {child}
        </View>
      ))}
    </View>
  );
}
