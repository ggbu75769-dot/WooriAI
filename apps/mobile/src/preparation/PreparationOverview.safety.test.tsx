import React from "react";
import renderer from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  Text: "Text",
  View: "View"
}));

vi.mock("../design-system", () => ({
  AppIcon: "AppIcon",
  EmptyStateCard: "EmptyStateCard",
  SectionCard: "SectionCard",
  semanticColors: {
    actionPrimary: "#d44727",
    borderSubtle: "#eaded8",
    surface: "#ffffff",
    textDisabled: "#999999",
    textPrimary: "#211d1a",
    textSecondary: "#665e59",
    warning: "#9a6300",
    warningSurface: "#fff7df"
  },
  spacing: { xs: 8, sm: 12 }
}));

import type { CatalogSafetyAlert, CatalogSafetyAlternativesResponse } from "../api/client";
import { SafetyAlertSection } from "./PreparationOverview";

const alert: CatalogSafetyAlert = {
  id: "alert-1",
  itemDefinitionId: "source-1",
  userItemPlanId: "plan-1",
  eventType: "provider_recalled",
  reason: "제조사 공식 리콜",
  itemContentVersion: 1,
  state: "unread",
  acknowledgedAt: null,
  version: 1,
  createdAt: "2026-07-26T00:00:00.000Z",
  planState: "owned",
  item: {
    id: "source-1",
    code: "SOURCE",
    nameKo: "리콜 품목",
    safetyTier: "high",
    safetyNote: "사용 중지",
    status: "published"
  },
  actionGuidance: "사용을 중지하세요.",
  sourceStatus: "official_or_professional_source_required"
};

const alternatives: CatalogSafetyAlternativesResponse = {
  state: "recalled",
  actionGuidance: "공식 안내를 확인하세요.",
  alternatives: [{
    id: "alternative-1",
    nameKo: "검증 대체 품목",
    safetyNote: "제품 식별 정보를 확인하세요.",
    reason: "공식 근거로 검토했어요.",
    evidence: {
      id: "evidence-1",
      title: "제조사 공식 대체 안내",
      publicUrl: "https://www.wooriai.kr/evidence"
    }
  }]
};

function props(overrides: Partial<React.ComponentProps<typeof SafetyAlertSection>> = {}) {
  return {
    alerts: [alert],
    pending: false,
    alternativeAlertId: "alert-1",
    alternatives,
    alternativesPending: false,
    alternativesError: false,
    onAcknowledge: vi.fn(),
    onShowAlternatives: vi.fn(),
    onOpenAlternative: vi.fn(),
    onOpenEvidence: vi.fn(),
    onRetryAlternatives: vi.fn(),
    ...overrides
  };
}

function text(node: renderer.ReactTestInstance) {
  return node.findAll((child) => String(child.type) === "Text").flatMap((child) => child.children).join("");
}

describe("mobile safety alternative alert", () => {
  it("renders provider recall copy, backed reason/evidence, and accessible actions", () => {
    const callbacks = props();
    let tree!: renderer.ReactTestRenderer;
    renderer.act(() => { tree = renderer.create(<SafetyAlertSection {...callbacks} />); });
    expect(tree.root.findAll((node) => String(node.type) === "Text").flatMap((node) => node.children).join(" ")).toContain("리콜 알림");
    expect(tree.root.findAll((node) => String(node.type) === "Text").flatMap((node) => node.children).join(" ")).toContain("공식 근거로 검토했어요.");
    expect(tree.root.findAll((node) => String(node.type) === "Text").flatMap((node) => node.children).join(" ")).toContain("제조사 공식 대체 안내");

    const buttons = tree.root.findAll((node) => String(node.type) === "Pressable");
    const toggle = buttons.find((node) => text(node) === "검증된 안전 대체 품목 접기")!;
    const itemButton = buttons.find((node) => text(node) === "대체 품목 보기")!;
    const evidenceButton = buttons.find((node) => text(node) === "검증 근거 열기")!;
    expect(toggle.props.accessibilityState).toEqual({ expanded: true });
    expect(toggle.props.accessibilityLabel).toContain("접기");
    expect(itemButton.props.accessibilityRole).toBe("button");
    expect(evidenceButton.props.accessibilityRole).toBe("link");
    renderer.act(() => toggle.props.onPress());
    renderer.act(() => itemButton.props.onPress());
    renderer.act(() => evidenceButton.props.onPress());
    expect(callbacks.onShowAlternatives).toHaveBeenCalledWith(alert);
    expect(callbacks.onOpenAlternative).toHaveBeenCalledWith("alternative-1");
    expect(callbacks.onOpenEvidence).toHaveBeenCalledWith("https://www.wooriai.kr/evidence");
  });

  it("labels provider corrections truthfully and does not offer a recalled-item action", () => {
    let tree!: renderer.ReactTestRenderer;
    renderer.act(() => {
      tree = renderer.create(<SafetyAlertSection {...props({
        alerts: [{ ...alert, eventType: "provider_corrected" }],
        alternativeAlertId: null,
        alternatives: undefined
      })} />);
    });
    const renderedText = tree.root.findAll((node) => String(node.type) === "Text").flatMap((node) => node.children).join(" ");
    expect(renderedText).toContain("리콜 정정 안내");
    expect(renderedText).not.toContain("검증된 안전 대체 품목 보기");
  });

  it("announces the collapsed alternative control state", () => {
    let tree!: renderer.ReactTestRenderer;
    renderer.act(() => {
      tree = renderer.create(<SafetyAlertSection {...props({
        alternativeAlertId: null,
        alternatives: undefined
      })} />);
    });
    const toggle = tree.root.findAll((node) => String(node.type) === "Pressable")
      .find((node) => text(node) === "검증된 안전 대체 품목 보기")!;
    expect(toggle.props.accessibilityState).toEqual({ expanded: false });
    expect(toggle.props.accessibilityLabel).toContain("보기");
  });
});
