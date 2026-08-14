import { Component, type ErrorInfo, type ReactNode } from "react";
import { View } from "react-native";
import { KoreanText as Text } from "../design-system/components/KoreanText";
import { reportCrash } from "./crash-adapter";

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    reportCrash(error, true);
  }

  render() {
    if (this.state.failed) {
      return <View style={{ alignItems: "center", flex: 1, justifyContent: "center", padding: 24 }}><Text>앱 화면을 불러오지 못했어요. 앱을 다시 열어 주세요.</Text></View>;
    }
    return this.props.children;
  }
}
