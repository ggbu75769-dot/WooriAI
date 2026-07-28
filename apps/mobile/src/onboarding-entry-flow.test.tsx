import React from "react";
import renderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
  replace: vi.fn()
}));

vi.mock("expo-router", () => ({
  Redirect: "Redirect",
  Slot: "Slot",
  router: navigation
}));
vi.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: "MaterialCommunityIcons" }));
vi.mock("@react-native-community/datetimepicker", () => ({ default: "DateTimePicker" }));
vi.mock("react-native", () => ({
  AccessibilityInfo: { setAccessibilityFocus: vi.fn() },
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Modal: "Modal",
  NativeModules: {},
  Platform: { OS: "android" },
  Pressable: "Pressable",
  SafeAreaView: "SafeAreaView",
  ScrollView: "ScrollView",
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
  findNodeHandle: () => 1,
  useWindowDimensions: () => ({ width: 320, height: 800, fontScale: 1.5 })
}));

import ChildStatusScreen from "../app/(onboarding)/child-status";
import OnboardingLayout from "../app/onboarding/_layout";
import { LOCAL_HOUSEHOLD_ID, LOCAL_USER_ID } from "./api/fixture-runtime";
import { useOnboardingDraftStore } from "./stores/onboarding-draft.store";
import { useSessionStore } from "./stores/session.store";

describe("standalone onboarding entry behavior", () => {
  beforeEach(() => {
    navigation.back.mockReset();
    navigation.push.mockReset();
    navigation.replace.mockReset();
    useOnboardingDraftStore.getState().resetDraft();
    useSessionStore.setState({
      accessToken: null,
      refreshToken: null,
      userId: null,
      displayName: null,
      email: null,
      authProvider: null,
      defaultHouseholdId: null,
      isTestSession: false
    });
  });

  it("creates the local draft scope before the first card can be selected", async () => {
    await useSessionStore.getState().startTestSession();

    expect(useOnboardingDraftStore.getState().draft).toMatchObject({
      userId: LOCAL_USER_ID,
      householdId: LOCAL_HOUSEHOLD_ID,
      selectedPath: null
    });

    const tree = renderer.create(<ChildStatusScreen />);
    expect(tree.root.findAll((node) => node.props.accessibilityRole === "radiogroup")).toHaveLength(1);
    expect(tree.root.findAll((node) => node.props.accessibilityLabel === "선택 취소")).toHaveLength(0);
    const radios = tree.root.findAll((node) => node.props.accessibilityRole === "radio");
    expect(radios).toHaveLength(3);

    act(() => radios[0]!.props.onPress());
    expect(useOnboardingDraftStore.getState().draft?.selectedPath).toBe("pregnant");
    act(() => tree.update(<ChildStatusScreen />));

    const selectedRadio = tree.root.findAll((node) => node.props.accessibilityRole === "radio")[0]!;
    expect(selectedRadio.props.accessibilityState).toEqual({ checked: true, selected: true });

    const nextButton = tree.root.find((node) => node.props.accessibilityLabel === "다음");
    expect(nextButton.props.disabled).toBe(false);
    expect(tree.root.findAll((node) => node.props.accessibilityLabel === "선택 취소")).toHaveLength(1);

    act(() => nextButton.props.onPress());
    expect(navigation.push).toHaveBeenCalledWith("/onboarding/pregnant");
  });

  it("repairs a missing scoped draft before a restarted onboarding route renders", () => {
    useSessionStore.setState({ isTestSession: true });
    useOnboardingDraftStore.getState().resetDraft();

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<OnboardingLayout />);
    });

    expect(useOnboardingDraftStore.getState().draft).toMatchObject({
      userId: LOCAL_USER_ID,
      householdId: LOCAL_HOUSEHOLD_ID
    });
    act(() => tree.update(<OnboardingLayout />));
    expect(tree.root.findAll((node) => String(node.type) === "Slot")).toHaveLength(1);
  });
});
