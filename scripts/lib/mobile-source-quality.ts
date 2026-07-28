import ts from "typescript";

export type MobileSourceQualityRule =
  | "LEGACY_FACADE_IMPORT"
  | "RAW_HEX_COLOR"
  | "FUNCTIONAL_EMOJI_ICON"
  | "MIXED_ICON_FAMILY"
  | "ICON_BUTTON_LABEL"
  | "TOUCH_TARGET"
  | "CTA_SINGLE_LINE"
  | "RAW_ERROR_EXPOSURE"
  | "INTERNAL_ENUM_COPY"
  | "SYNTHETIC_CHILD_FALLBACK"
  | "SCREEN_CREATE_CHILD"
  | "DOMAIN_IMPLICIT_CLOCK"
  | "ROOT_QUERY_INVALIDATION"
  | "UNTYPED_DEEP_LINK"
  | "UNSAFE_ANY_CAST";

export type MobileSourceQualityFinding = {
  rule: MobileSourceQualityRule;
  file: string;
  line: number;
  message: string;
};

const legacyDomainWidgets = new Set([
  "DonutChartCard",
  "FamilyAvatarGroup",
  "HeroSummaryCard",
  "LineChartCard",
  "ProductCard",
  "ProductComparisonRow",
  "SegmentedControl"
]);

const exceptionPattern = /release5v-source-quality-exception:.*owner=[a-z0-9-]+;\s*review=\d{4}-\d{2}-\d{2}\./i;
const rawHexPattern = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?$/i;
const emojiPattern = /\p{Extended_Pictographic}/u;

function lineOf(sourceFile: ts.SourceFile, node: ts.Node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function textContainsException(sourceFile: ts.SourceFile, node: ts.Node) {
  const start = Math.max(0, node.getFullStart() - 260);
  return exceptionPattern.test(sourceFile.text.slice(start, node.getStart(sourceFile)));
}

function jsxAttribute(node: ts.JsxAttributes, name: string) {
  return node.properties.find((property): property is ts.JsxAttribute =>
    ts.isJsxAttribute(property) && property.name.getText() === name
  );
}

function literalNumber(attribute: ts.JsxAttribute | undefined) {
  if (!attribute?.initializer || !ts.isJsxExpression(attribute.initializer)) return null;
  return attribute.initializer.expression && ts.isNumericLiteral(attribute.initializer.expression)
    ? Number(attribute.initializer.expression.text)
    : null;
}

function includesIdentifier(node: ts.Node, pattern: RegExp) {
  let matched = false;
  const visit = (child: ts.Node) => {
    if (ts.isIdentifier(child) && pattern.test(child.text)) matched = true;
    if (!matched) ts.forEachChild(child, visit);
  };
  visit(node);
  return matched;
}

export function analyzeMobileSourceText(file: string, sourceText: string): MobileSourceQualityFinding[] {
  const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const findings: MobileSourceQualityFinding[] = [];
  const normalizedFile = file.replace(/\\/g, "/");
  const isOnboardingDomain = normalizedFile.endsWith("packages/domain/src/onboarding.ts");
  const add = (rule: MobileSourceQualityRule, node: ts.Node, message: string) => {
    findings.push({ rule, file, line: lineOf(sourceFile, node), message });
  };

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const moduleName = node.moduleSpecifier.text;
      if (/(^|\/)ui$/.test(moduleName)) {
        const names = node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
          ? node.importClause.namedBindings.elements.map((element) => element.name.text)
          : [];
        const onlyApprovedDomainWidgets = names.length > 0 && names.every((name) => legacyDomainWidgets.has(name));
        if (!onlyApprovedDomainWidgets || !textContainsException(sourceFile, node)) {
          add("LEGACY_FACADE_IMPORT", node, "Legacy UI imports require a domain-widget allowlist plus owner and review date.");
        }
      }
      if (moduleName.includes("vector-icons") && !file.replace(/\\/g, "/").includes("/design-system/")) {
        add("MIXED_ICON_FAMILY", node, "Routes must consume the Design System icon wrapper.");
      }
    }

    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && rawHexPattern.test(node.text)) {
      add("RAW_HEX_COLOR", node, "Use a semantic Design System color token.");
    }

    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tag = node.tagName.getText(sourceFile);
      const attributes = node.attributes;
      if (tag === "IconButton" && !jsxAttribute(attributes, "accessibilityLabel")) {
        add("ICON_BUTTON_LABEL", node, "Icon-only controls need an accessibilityLabel.");
      }
      if (tag === "IconButton") {
        const size = literalNumber(jsxAttribute(attributes, "size"));
        if (size !== null && size < 48) add("TOUCH_TARGET", node, "Icon button interaction size must be at least 48dp.");
      }
      if (tag === "PrimaryButton" && literalNumber(jsxAttribute(attributes, "numberOfLines")) === 1) {
        add("CTA_SINGLE_LINE", node, "Primary CTA text must not be forced to a single clipped line.");
      }
      const icon = jsxAttribute(attributes, "icon")?.initializer;
      if (icon && ts.isStringLiteral(icon) && emojiPattern.test(icon.text)) {
        add("FUNCTIONAL_EMOJI_ICON", node, "Functional icons must use the shared icon family.");
      }
    }

    if (ts.isPropertyAccessExpression(node) && node.name.text === "message" && includesIdentifier(node.expression, /^(error|err)$/i)) {
      add("RAW_ERROR_EXPOSURE", node, "Screens must branch on typed error codes instead of raw messages.");
    }

    if (ts.isJsxExpression(node) && node.expression && ts.isPropertyAccessExpression(node.expression)
      && ["manualStage", "preparedStepState", "selectedPath", "stageOverride"].includes(node.expression.name.text)) {
      add("INTERNAL_ENUM_COPY", node, "Format internal enum values before rendering them.");
    }

    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      && includesIdentifier(node.left, /selectedChild/i)
      && includesIdentifier(node.right, /(default|fixture|mock|sample|synthetic)Child/i)) {
      add("SYNTHETIC_CHILD_FALLBACK", node, "Selected-child fallback must not synthesize a child.");
    }

    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(sourceFile);
      if (/createChild$/.test(callee) && file.replace(/\\/g, "/").includes("/app/")) {
        add("SCREEN_CREATE_CHILD", node, "Screens must not create a child outside final onboarding completion.");
      }
      if (/queryClient\.invalidateQueries$/.test(callee)) {
        const first = node.arguments[0];
        if (!first || !includesIdentifier(first, /queryKey/)) {
          add("ROOT_QUERY_INVALIDATION", node, "Query invalidation must be scoped by a typed query key.");
        }
      }
      if (/router\.(push|replace|navigate)$/.test(callee) && node.arguments[0]
        && (ts.isTemplateExpression(node.arguments[0]) || ts.isBinaryExpression(node.arguments[0])
          || (ts.isAsExpression(node.arguments[0]) && node.arguments[0].type.kind === ts.SyntaxKind.AnyKeyword))) {
        add("UNTYPED_DEEP_LINK", node, "Computed routes must use a typed route mapping instead of unchecked composition.");
      }
      if (isOnboardingDomain
        && ["Date.now", "Math.random"].includes(callee)) {
        add("DOMAIN_IMPLICIT_CLOCK", node, "Pure onboarding domain code requires an injected clock or seed.");
      }
      if (isOnboardingDomain
        && callee === "Date" && node.expression.kind === ts.SyntaxKind.Identifier) {
        add("DOMAIN_IMPLICIT_CLOCK", node, "Pure onboarding domain code requires an injected reference date.");
      }
    }

    if (ts.isNewExpression(node) && isOnboardingDomain
      && node.expression.getText(sourceFile) === "Date") {
      add("DOMAIN_IMPLICIT_CLOCK", node, "Pure onboarding domain code requires an injected reference date.");
    }

    if (ts.isAsExpression(node) && node.type.kind === ts.SyntaxKind.AnyKeyword) {
      add("UNSAFE_ANY_CAST", node, "Avoid as any in release-qualified mobile paths.");
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return findings;
}
