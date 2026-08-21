import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";
import {
  caughtBoundaryState,
  devErrorDetail,
  formatBoundaryLog,
  initialBoundaryState,
  resetBoundaryState,
  type ErrorBoundaryState
} from "./error-boundary-core";

/**
 * MOB-108 — global render-crash boundary. Instead of a white screen / app kill, shows a warm
 * in-theme recovery screen with a [다시 시도] reset.
 *
 * Deliberately a class component (error boundaries require componentDidCatch) with minimal
 * imports: react, react-native primitives, theme tokens, and the pure core module only. It must
 * never import hooks/stores/query clients — anything stateful could itself be the thing that
 * crashed, and the boundary has to stay renderable when the rest of the app is not.
 *
 * "기록은 안전하게 저장되어 있어요" is true, not reassurance-theater: expenses are written to the
 * offline store (src/offline) before any network sync, so a render crash never loses records.
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = initialBoundaryState();

  static getDerivedStateFromError(thrown: unknown): Pick<ErrorBoundaryState, "error"> {
    return caughtBoundaryState(thrown);
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // No crash pipeline yet (Sentry 추후) — structured console.error so device logs are grep-able.
    console.error(...formatBoundaryLog(error, info.componentStack));
  }

  handleRetry = (): void => {
    // Clears the error and bumps retryKey so the children subtree remounts from scratch.
    this.setState((previous) => resetBoundaryState(previous));
  };

  render(): React.ReactNode {
    const { error, retryKey } = this.state;

    if (error !== null) {
      const detail = devErrorDetail(error, __DEV__);
      return (
        <View style={styles.container}>
          <Text style={styles.emoji} accessible={false}>
            🍼
          </Text>
          <Text style={styles.title} accessibilityRole="header">
            앗, 문제가 생겼어요
          </Text>
          <Text style={styles.body}>
            기록은 안전하게 저장되어 있어요{"\n"}잠시 후 다시 시도해 주세요
          </Text>
          <Pressable
            onPress={this.handleRetry}
            accessibilityRole="button"
            accessibilityLabel="다시 시도"
            style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
          >
            <Text style={styles.retryLabel}>다시 시도</Text>
          </Pressable>
          {detail !== null ? (
            <ScrollView style={styles.detailBox} contentContainerStyle={styles.detailContent}>
              <Text style={styles.detailText}>{detail}</Text>
            </ScrollView>
          ) : null}
        </View>
      );
    }

    return <React.Fragment key={retryKey}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.cream.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.screen
  },
  emoji: {
    fontSize: 44,
    marginBottom: theme.spacing.gap
  },
  title: {
    fontSize: theme.typography.headline2.fontSize,
    lineHeight: theme.typography.headline2.lineHeight,
    fontWeight: theme.typography.headline2.fontWeight,
    color: theme.colors.text.primary,
    textAlign: "center"
  },
  body: {
    marginTop: theme.spacing.gap,
    fontSize: theme.typography.body1.fontSize,
    lineHeight: theme.typography.body1.lineHeight,
    color: theme.colors.text.secondary,
    textAlign: "center"
  },
  retryButton: {
    marginTop: theme.spacing.section,
    minHeight: theme.ctaHeight,
    minWidth: 200,
    paddingHorizontal: theme.spacing.screen,
    borderRadius: theme.radii.button,
    backgroundColor: theme.colors.coral[500],
    alignItems: "center",
    justifyContent: "center"
  },
  retryButtonPressed: {
    backgroundColor: theme.colors.coral[600]
  },
  retryLabel: {
    fontSize: theme.typography.headline3.fontSize,
    fontWeight: theme.typography.headline3.fontWeight,
    color: theme.colors.cream.surface
  },
  detailBox: {
    marginTop: theme.spacing.section,
    maxHeight: 160,
    alignSelf: "stretch",
    borderRadius: theme.radii.small,
    backgroundColor: theme.colors.cream.surfaceAlt
  },
  detailContent: {
    padding: theme.spacing.card
  },
  detailText: {
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
    color: theme.colors.text.tertiary,
    fontFamily: "monospace"
  }
});
