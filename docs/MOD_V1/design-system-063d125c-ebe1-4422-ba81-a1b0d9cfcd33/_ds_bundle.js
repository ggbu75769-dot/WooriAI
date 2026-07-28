/* @ds-bundle: {"format":4,"namespace":"DesignSystem_063d12","components":[{"name":"Button","sourcePath":"components/actions/Button.jsx"},{"name":"IconButton","sourcePath":"components/actions/IconButton.jsx"},{"name":"Card","sourcePath":"components/content/Card.jsx"},{"name":"ListRow","sourcePath":"components/content/ListRow.jsx"},{"name":"AccessibleDataTable","sourcePath":"components/dataviz/AccessibleDataTable.jsx"},{"name":"ChartContainer","sourcePath":"components/dataviz/ChartContainer.jsx"},{"name":"PeriodNavigator","sourcePath":"components/dataviz/PeriodNavigator.jsx"},{"name":"BudgetSummary","sourcePath":"components/domain/BudgetSummary.jsx"},{"name":"ItemStatusControl","sourcePath":"components/domain/ItemStatusControl.jsx"},{"name":"MoneyText","sourcePath":"components/domain/MoneyText.jsx"},{"name":"PreparationItemCard","sourcePath":"components/domain/PreparationItemCard.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"ErrorState","sourcePath":"components/feedback/ErrorState.jsx"},{"name":"OfflineState","sourcePath":"components/feedback/OfflineState.jsx"},{"name":"Skeleton","sourcePath":"components/feedback/Skeleton.jsx"},{"name":"Snackbar","sourcePath":"components/feedback/Snackbar.jsx"},{"name":"SyncStatusBar","sourcePath":"components/feedback/SyncStatusBar.jsx"},{"name":"DateField","sourcePath":"components/forms/DateField.jsx"},{"name":"MoneyField","sourcePath":"components/forms/MoneyField.jsx"},{"name":"TextField","sourcePath":"components/forms/TextField.jsx"},{"name":"BottomSheet","sourcePath":"components/overlay/BottomSheet.jsx"},{"name":"Dialog","sourcePath":"components/overlay/Dialog.jsx"},{"name":"CheckCard","sourcePath":"components/selection/CheckCard.jsx"},{"name":"FilterChip","sourcePath":"components/selection/FilterChip.jsx"},{"name":"RadioCard","sourcePath":"components/selection/RadioCard.jsx"},{"name":"SegmentedTabs","sourcePath":"components/selection/SegmentedTabs.jsx"},{"name":"StatusChip","sourcePath":"components/selection/StatusChip.jsx"},{"name":"BottomNavigation","sourcePath":"components/shell/BottomNavigation.jsx"},{"name":"StageBadgeLabel","sourcePath":"components/shell/ChildContextSwitcher.helpers.js"},{"name":"ChildContextSwitcher","sourcePath":"components/shell/ChildContextSwitcher.jsx"},{"name":"ScreenScaffold","sourcePath":"components/shell/ScreenScaffold.jsx"},{"name":"TopAppBar","sourcePath":"components/shell/TopAppBar.jsx"}],"sourceHashes":{"components/actions/Button.jsx":"cc1e08d8b356","components/actions/IconButton.jsx":"141ba48bf08d","components/content/Card.jsx":"0f7e2d54dfb7","components/content/ListRow.jsx":"7bb179cc92c1","components/dataviz/AccessibleDataTable.jsx":"229f41a0a75f","components/dataviz/ChartContainer.jsx":"cf8791c10984","components/dataviz/PeriodNavigator.jsx":"1e82030bb108","components/domain/BudgetSummary.jsx":"ec15aa0bdc36","components/domain/ItemStatusControl.jsx":"abb23f9f034d","components/domain/MoneyText.jsx":"c6ee1731daac","components/domain/PreparationItemCard.jsx":"8a34400539ed","components/feedback/EmptyState.jsx":"a2aebd39d7a7","components/feedback/ErrorState.jsx":"005fcf108ce1","components/feedback/OfflineState.jsx":"c7674909dd32","components/feedback/Skeleton.jsx":"2ff13f8809d8","components/feedback/Snackbar.jsx":"b52e181485ff","components/feedback/SyncStatusBar.jsx":"e9be2cd0b1db","components/forms/DateField.jsx":"44092a16bade","components/forms/MoneyField.jsx":"a8f77fb77864","components/forms/TextField.jsx":"27394ede66a7","components/overlay/BottomSheet.jsx":"593760d16212","components/overlay/Dialog.jsx":"7061770b82e7","components/selection/CheckCard.jsx":"bc0f53688c67","components/selection/FilterChip.jsx":"078184ac0bdf","components/selection/RadioCard.jsx":"507a6c5ae376","components/selection/SegmentedTabs.jsx":"278203a4b62f","components/selection/StatusChip.jsx":"861ec210bd03","components/shell/BottomNavigation.jsx":"d0a531997711","components/shell/ChildContextSwitcher.helpers.js":"9f1fa49fecb5","components/shell/ChildContextSwitcher.jsx":"1dc91a6ea95c","components/shell/ScreenScaffold.jsx":"24389eaf9be5","components/shell/TopAppBar.jsx":"251ae0873fcf","ui_kits/mobile/HomeScreen.jsx":"a52f9df0f79a","ui_kits/mobile/ItemsScreen.jsx":"b2040a738700","ui_kits/mobile/LoginScreen.jsx":"39481ad830d1","ui_kits/mobile/OnboardingFlow.jsx":"f4b3ddd4bd68","ui_kits/mobile/ProfileScreen.jsx":"1427a67de139","ui_kits/mobile/RecordsScreen.jsx":"02734ebe5806","ui_kits/mobile/ReportsScreen.jsx":"606fedd4aed0"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.DesignSystem_063d12 = window.DesignSystem_063d12 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/actions/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const H = {
  large: "var(--size-button-lg)",
  medium: "var(--size-button-md)"
};
const P = {
  large: "0 var(--space-5)",
  medium: "0 var(--space-4)"
};
function Button({
  variant = "primary",
  size = "large",
  loading = false,
  disabled = false,
  icon,
  children,
  style,
  onClick,
  ...rest
}) {
  const off = disabled || loading;
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: H[size] || H.large,
    padding: P[size] || P.large,
    borderRadius: "var(--radius-md)",
    font: "700 var(--type-label-lg-size)/1 var(--font-sans)",
    cursor: off ? "default" : "pointer",
    border: "1px solid transparent",
    transition: "background var(--duration-fast) var(--ease-standard),opacity var(--duration-fast) var(--ease-standard)",
    boxSizing: "border-box"
  };
  const variants = {
    primary: {
      background: "var(--action-primary)",
      color: "var(--action-primary-text)"
    },
    secondary: {
      background: "var(--action-secondary)",
      color: "var(--action-secondary-text)",
      borderColor: "var(--action-secondary-border)"
    },
    tertiary: {
      background: "transparent",
      color: "var(--text-brand)"
    },
    destructive: {
      background: "var(--status-danger-content)",
      color: "var(--text-inverse)"
    }
  };
  const offStyle = off ? variant === "tertiary" ? {
    color: "var(--action-disabled-text)"
  } : {
    background: "var(--action-disabled-bg)",
    color: "var(--action-disabled-text)",
    borderColor: "transparent"
  } : {};
  const press = e => {
    if (off) return;
    if (variant === "primary") e.currentTarget.style.background = "var(--action-primary-pressed)";
    if (variant === "secondary") e.currentTarget.style.background = "var(--action-secondary-pressed)";
    if (variant === "destructive") e.currentTarget.style.opacity = "0.85";
    if (variant === "tertiary") e.currentTarget.style.opacity = "0.7";
  };
  const release = e => {
    const v = variants[variant] || variants.primary;
    e.currentTarget.style.background = v.background;
    e.currentTarget.style.opacity = "1";
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: off,
    "aria-busy": loading || undefined,
    onMouseDown: press,
    onMouseUp: release,
    onMouseLeave: release,
    onClick: off ? undefined : onClick,
    style: {
      ...base,
      ...(variants[variant] || variants.primary),
      ...offStyle,
      ...style
    }
  }, rest), loading ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: 16,
      height: 16,
      border: "2px solid currentColor",
      borderRightColor: "transparent",
      borderRadius: "50%",
      animation: "ds-spin .7s linear infinite"
    }
  }) : icon ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    className: `mdi mdi-${icon}`,
    style: {
      fontSize: "var(--size-icon-md)",
      lineHeight: 1
    }
  }) : null, children, /*#__PURE__*/React.createElement("style", null, "@keyframes ds-spin{to{transform:rotate(1turn)}}"));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/Button.jsx", error: String((e && e.message) || e) }); }

// components/actions/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function IconButton({
  icon,
  label,
  size = 48,
  tone = "neutral",
  disabled = false,
  onClick,
  style,
  ...rest
}) {
  const colors = {
    neutral: "var(--text-primary)",
    brand: "var(--action-primary)",
    inverse: "var(--text-inverse)"
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label,
    title: label,
    disabled: disabled,
    onClick: onClick,
    onMouseDown: e => {
      if (!disabled) e.currentTarget.style.background = "var(--bg-subtle)";
    },
    onMouseUp: e => e.currentTarget.style.background = "transparent",
    onMouseLeave: e => e.currentTarget.style.background = "transparent",
    style: {
      width: size,
      height: size,
      minWidth: "var(--size-touch-min)",
      minHeight: "var(--size-touch-min)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      background: "transparent",
      border: "none",
      borderRadius: "var(--radius-full)",
      cursor: disabled ? "default" : "pointer",
      color: disabled ? "var(--action-disabled-text)" : colors[tone] || colors.neutral,
      transition: "background var(--duration-fast) var(--ease-standard)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    className: `mdi mdi-${icon}`,
    style: {
      fontSize: "var(--size-icon-lg)",
      lineHeight: 1
    }
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/content/Card.jsx
try { (() => {
function Card({
  variant = "default",
  onClick,
  children,
  style
}) {
  const clickable = Boolean(onClick);
  const variants = {
    default: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      boxShadow: "var(--shadow-1)"
    },
    subtle: {
      background: "var(--bg-subtle)",
      border: "1px solid transparent"
    },
    brand: {
      background: "var(--action-primary)",
      color: "var(--text-inverse)",
      border: "none",
      boxShadow: "var(--shadow-2)"
    },
    soft: {
      background: "var(--action-primary-soft)",
      border: "1px solid transparent"
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    role: clickable ? "button" : undefined,
    tabIndex: clickable ? 0 : undefined,
    onMouseDown: e => {
      if (clickable) e.currentTarget.style.opacity = "0.88";
    },
    onMouseUp: e => e.currentTarget.style.opacity = "1",
    onMouseLeave: e => e.currentTarget.style.opacity = "1",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)",
      padding: "var(--space-4)",
      borderRadius: "var(--radius-lg)",
      cursor: clickable ? "pointer" : undefined,
      transition: "opacity var(--duration-fast) var(--ease-standard)",
      boxSizing: "border-box",
      ...(variants[variant] || variants.default),
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/Card.jsx", error: String((e && e.message) || e) }); }

// components/content/ListRow.jsx
try { (() => {
function ListRow({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  value,
  badge,
  onPress,
  style
}) {
  const clickable = Boolean(onPress);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onPress,
    role: clickable ? "button" : undefined,
    tabIndex: clickable ? 0 : undefined,
    onMouseDown: e => {
      if (clickable) e.currentTarget.style.opacity = "0.85";
    },
    onMouseUp: e => e.currentTarget.style.opacity = "1",
    onMouseLeave: e => e.currentTarget.style.opacity = "1",
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-3)",
      minHeight: 56,
      padding: "var(--space-2) 0",
      cursor: clickable ? "pointer" : undefined,
      transition: "opacity var(--duration-fast) var(--ease-standard)",
      ...style
    }
  }, icon ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: 40,
      height: 40,
      flex: "none",
      borderRadius: "50%",
      background: iconBg || "var(--brand-100)",
      color: iconColor || "var(--brand-600)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: `mdi mdi-${icon}`,
    style: {
      fontSize: "var(--size-icon-md)",
      lineHeight: 1
    }
  })) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "700 var(--type-body-md-size)/var(--type-body-md-lh) var(--font-sans)",
      color: "var(--text-primary)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, title), subtitle ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 var(--type-caption-size)/var(--type-caption-lh) var(--font-sans)",
      color: "var(--text-secondary)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, subtitle) : null), value || badge ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: 4
    }
  }, value ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "600 var(--type-body-md-size)/1 var(--font-sans)",
      fontVariantNumeric: "tabular-nums",
      color: "var(--text-primary)"
    }
  }, value) : null, badge) : null);
}
Object.assign(__ds_scope, { ListRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/ListRow.jsx", error: String((e && e.message) || e) }); }

// components/dataviz/AccessibleDataTable.jsx
try { (() => {
function AccessibleDataTable({
  columns = [],
  rows = [],
  caption,
  style
}) {
  return /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse",
      fontFamily: "var(--font-sans)",
      ...style
    }
  }, caption ? /*#__PURE__*/React.createElement("caption", {
    style: {
      textAlign: "left",
      font: "700 var(--type-caption-size)/var(--type-caption-lh) var(--font-sans)",
      color: "var(--text-tertiary)",
      paddingBottom: 8
    }
  }, caption) : null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map((c, i) => /*#__PURE__*/React.createElement("th", {
    key: c,
    scope: "col",
    style: {
      textAlign: i === 0 ? "left" : "right",
      padding: "8px 4px",
      borderBottom: "1px solid var(--border-strong)",
      font: "600 var(--type-caption-size)/var(--type-caption-lh) var(--font-sans)",
      color: "var(--text-secondary)"
    }
  }, c)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((r, ri) => /*#__PURE__*/React.createElement("tr", {
    key: ri
  }, r.map((cell, ci) => /*#__PURE__*/React.createElement("td", {
    key: ci,
    style: {
      textAlign: ci === 0 ? "left" : "right",
      padding: "10px 4px",
      borderBottom: "1px solid var(--border-default)",
      font: `${ci === 0 ? 400 : 600} var(--type-body-md-size)/var(--type-body-md-lh) var(--font-sans)`,
      fontVariantNumeric: "tabular-nums",
      color: "var(--text-primary)"
    }
  }, cell))))));
}
Object.assign(__ds_scope, { AccessibleDataTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/dataviz/AccessibleDataTable.jsx", error: String((e && e.message) || e) }); }

// components/dataviz/PeriodNavigator.jsx
try { (() => {
function PeriodNavigator({
  label,
  onPrev,
  onNext,
  nextDisabled = false,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      fontFamily: "var(--font-sans)",
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "chevron-left",
    label: "\uC774\uC804 \uAE30\uAC04",
    onClick: onPrev
  }), /*#__PURE__*/React.createElement("span", {
    "aria-live": "polite",
    style: {
      font: "700 var(--type-heading-md-size)/var(--type-heading-md-lh) var(--font-sans)",
      color: "var(--text-primary)"
    }
  }, label), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "chevron-right",
    label: "\uB2E4\uC74C \uAE30\uAC04",
    onClick: onNext,
    disabled: nextDisabled
  }));
}
Object.assign(__ds_scope, { PeriodNavigator });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/dataviz/PeriodNavigator.jsx", error: String((e && e.message) || e) }); }

// components/domain/ItemStatusControl.jsx
try { (() => {
const FLOW = ["알아보기", "예정", "주문", "보유"];
function ItemStatusControl({
  value = "알아보기",
  onChange,
  options,
  style
}) {
  const list = options || FLOW;
  return /*#__PURE__*/React.createElement("div", {
    role: "radiogroup",
    "aria-label": "\uC900\uBE44 \uC0C1\uD0DC",
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      ...style
    }
  }, list.map((s, i) => {
    const on = s === value;
    const passed = list.indexOf(value) > i;
    return /*#__PURE__*/React.createElement("button", {
      key: s,
      type: "button",
      role: "radio",
      "aria-checked": on,
      onClick: () => onChange && onChange(s),
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        minHeight: 40,
        padding: "0 var(--space-3)",
        borderRadius: "var(--radius-full)",
        border: `1.5px solid ${on ? "var(--action-primary)" : passed ? "var(--brand-200)" : "var(--border-default)"}`,
        background: on ? "var(--action-primary)" : passed ? "var(--action-primary-soft)" : "var(--bg-surface)",
        color: on ? "var(--action-primary-text)" : passed ? "var(--text-brand)" : "var(--text-secondary)",
        font: "700 var(--type-label-md-size)/1 var(--font-sans)",
        whiteSpace: "nowrap",
        cursor: "pointer",
        transition: "background var(--duration-fast) var(--ease-standard)"
      }
    }, passed ? /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      className: "mdi mdi-check",
      style: {
        fontSize: 14
      }
    }) : null, s);
  }));
}
Object.assign(__ds_scope, { ItemStatusControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/domain/ItemStatusControl.jsx", error: String((e && e.message) || e) }); }

// components/domain/MoneyText.jsx
try { (() => {
const SIZES = {
  xl: ["var(--type-money-xl-size)", "var(--type-money-xl-lh)"],
  lg: ["var(--type-money-lg-size)", "var(--type-money-lg-lh)"],
  md: ["var(--type-money-md-size)", "var(--type-money-md-lh)"]
};
function MoneyText({
  amount,
  size = "md",
  sign,
  color,
  style
}) {
  const n = Number.isFinite(amount) ? Math.abs(amount) : 0;
  const [fs, lh] = SIZES[size] || SIZES.md;
  const c = color || (sign ? "var(--status-success-content)" : "var(--text-primary)");
  return /*#__PURE__*/React.createElement("span", {
    style: {
      color: c,
      fontFamily: "var(--font-sans)",
      fontWeight: 700,
      fontVariantNumeric: "tabular-nums",
      lineHeight: lh,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: fs
    }
  }, sign ? "+" : "", n.toLocaleString("ko-KR")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: `calc(${fs} * 0.6)`,
      fontWeight: 600
    }
  }, "\uC6D0"));
}
Object.assign(__ds_scope, { MoneyText });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/domain/MoneyText.jsx", error: String((e && e.message) || e) }); }

// components/domain/BudgetSummary.jsx
try { (() => {
function BudgetSummary({
  label = "이번 달 지출",
  usedKrw,
  budgetKrw,
  ctaLabel,
  onCta,
  style
}) {
  const pct = budgetKrw > 0 ? Math.round(Math.min(100, Math.max(0, usedKrw / budgetKrw * 100))) : 0;
  const over = budgetKrw > 0 && usedKrw > budgetKrw;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)",
      padding: "var(--space-5)",
      background: "var(--action-primary)",
      color: "var(--text-inverse)",
      borderRadius: "var(--radius-2xl)",
      boxShadow: "var(--shadow-2)",
      fontFamily: "var(--font-sans)",
      boxSizing: "border-box",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 var(--type-caption-size)/var(--type-caption-lh) var(--font-sans)",
      opacity: 0.9
    }
  }, label), /*#__PURE__*/React.createElement(__ds_scope.MoneyText, {
    amount: usedKrw,
    size: "xl",
    color: "var(--text-inverse)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      font: "400 var(--type-caption-size)/var(--type-caption-lh) var(--font-sans)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.9
    }
  }, budgetKrw > 0 ? `예산 ${budgetKrw.toLocaleString("ko-KR")}원` : "예산이 아직 없어요"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700
    }
  }, budgetKrw > 0 ? over ? `${(usedKrw - budgetKrw).toLocaleString("ko-KR")}원 초과` : `${pct}%` : "")), budgetKrw > 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8,
      borderRadius: "var(--radius-full)",
      background: "rgba(255,255,255,0.35)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${pct}%`,
      height: "100%",
      borderRadius: "var(--radius-full)",
      background: "var(--warm-0)",
      transition: "width var(--duration-slow) var(--ease-standard)"
    }
  })) : null, ctaLabel ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onCta,
    style: {
      alignSelf: "flex-start",
      minHeight: 40,
      padding: "0 var(--space-4)",
      border: "none",
      borderRadius: "var(--radius-full)",
      background: "rgba(255,255,255,0.18)",
      color: "var(--text-inverse)",
      font: "700 var(--type-label-md-size)/1 var(--font-sans)",
      cursor: "pointer"
    }
  }, ctaLabel) : null);
}
Object.assign(__ds_scope, { BudgetSummary });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/domain/BudgetSummary.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
function EmptyState({
  icon,
  image,
  title,
  description,
  ctaLabel,
  onCta,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 10,
      padding: "var(--space-6) var(--space-4)",
      background: "var(--bg-subtle)",
      borderRadius: "var(--radius-lg)",
      textAlign: "center",
      fontFamily: "var(--font-sans)",
      ...style
    }
  }, image ? /*#__PURE__*/React.createElement("img", {
    src: image,
    alt: "",
    style: {
      width: 72,
      height: 72,
      objectFit: "contain"
    }
  }) : icon ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    className: `mdi mdi-${icon}`,
    style: {
      fontSize: "var(--size-icon-xl)",
      color: "var(--warm-400)"
    }
  }) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "700 var(--type-body-lg-size)/var(--type-body-lg-lh) var(--font-sans)",
      color: "var(--text-primary)"
    }
  }, title), description ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 var(--type-body-md-size)/var(--type-body-md-lh) var(--font-sans)",
      color: "var(--text-secondary)"
    }
  }, description) : null, ctaLabel ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onCta,
    style: {
      marginTop: 4,
      minHeight: "var(--size-touch-min)",
      padding: "0 var(--space-5)",
      border: "none",
      borderRadius: "var(--radius-full)",
      background: "var(--action-primary)",
      color: "var(--action-primary-text)",
      font: "700 var(--type-label-md-size)/1 var(--font-sans)",
      cursor: "pointer"
    }
  }, ctaLabel) : null);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/dataviz/ChartContainer.jsx
try { (() => {
const {
  useState
} = React;
function ChartContainer({
  title,
  summary,
  recordCount = 0,
  minRecords = 3,
  emptyTitle = "아직 분석할 기록이 부족해요",
  emptyDescription = "기록이 3건 이상 모이면 분석을 보여드려요.",
  emptyCtaLabel,
  onEmptyCta,
  tableColumns,
  tableRows,
  children,
  style
}) {
  const [showTable, setShowTable] = useState(false);
  const gated = recordCount < minRecords;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)",
      padding: "var(--space-4)",
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-1)",
      fontFamily: "var(--font-sans)",
      boxSizing: "border-box",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: "700 var(--type-body-md-size)/var(--type-body-md-lh) var(--font-sans)",
      color: "var(--text-secondary)"
    }
  }, title), !gated && tableRows ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-pressed": showTable,
    onClick: () => setShowTable(v => !v),
    style: {
      border: "1px solid var(--border-strong)",
      background: showTable ? "var(--bg-subtle)" : "var(--bg-surface)",
      borderRadius: "var(--radius-full)",
      minHeight: 32,
      padding: "0 var(--space-3)",
      font: "700 var(--type-caption-size)/1 var(--font-sans)",
      color: "var(--text-secondary)",
      whiteSpace: "nowrap",
      cursor: "pointer"
    }
  }, showTable ? "차트 보기" : "표 보기") : null), summary && !gated ? /*#__PURE__*/React.createElement("div", null, summary) : null, gated ? /*#__PURE__*/React.createElement(__ds_scope.EmptyState, {
    icon: "chart-line",
    title: emptyTitle,
    description: emptyDescription,
    ctaLabel: emptyCtaLabel,
    onCta: onEmptyCta
  }) : showTable && tableRows ? /*#__PURE__*/React.createElement(__ds_scope.AccessibleDataTable, {
    columns: tableColumns,
    rows: tableRows,
    caption: title
  }) : children);
}
Object.assign(__ds_scope, { ChartContainer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/dataviz/ChartContainer.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ErrorState.jsx
try { (() => {
function ErrorState({
  kind = "recoverable",
  title,
  description,
  retryLabel = "다시 시도",
  onRetry,
  style
}) {
  const fatal = kind === "fatal";
  return /*#__PURE__*/React.createElement("div", {
    role: "alert",
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 10,
      padding: "var(--space-6) var(--space-4)",
      background: "var(--status-danger-surface)",
      borderRadius: "var(--radius-lg)",
      textAlign: "center",
      fontFamily: "var(--font-sans)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    className: `mdi mdi-${fatal ? "alert-octagon-outline" : "refresh"}`,
    style: {
      fontSize: "var(--size-icon-xl)",
      color: "var(--status-danger-content)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "700 var(--type-body-lg-size)/var(--type-body-lg-lh) var(--font-sans)",
      color: "var(--text-primary)"
    }
  }, title || (fatal ? "문제가 계속되고 있어요" : "불러오지 못했어요")), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 var(--type-body-md-size)/var(--type-body-md-lh) var(--font-sans)",
      color: "var(--text-secondary)"
    }
  }, description || (fatal ? "앱을 다시 실행해 주세요. 입력한 내용은 안전하게 보관돼요." : "잠시 후 다시 시도해 주세요.")), !fatal && onRetry ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onRetry,
    style: {
      marginTop: 4,
      minHeight: "var(--size-touch-min)",
      padding: "0 var(--space-5)",
      border: "1px solid var(--status-danger-content)",
      borderRadius: "var(--radius-full)",
      background: "var(--bg-surface)",
      color: "var(--status-danger-content)",
      font: "700 var(--type-label-md-size)/1 var(--font-sans)",
      cursor: "pointer"
    }
  }, retryLabel) : null);
}
Object.assign(__ds_scope, { ErrorState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ErrorState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/OfflineState.jsx
try { (() => {
function OfflineState({
  pendingCount = 0,
  title,
  description,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "var(--space-4)",
      background: "var(--status-warning-surface)",
      borderRadius: "var(--radius-lg)",
      fontFamily: "var(--font-sans)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    className: "mdi mdi-wifi-off",
    style: {
      fontSize: "var(--size-icon-lg)",
      color: "var(--status-warning-content)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 2,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "700 var(--type-body-md-size)/var(--type-body-md-lh) var(--font-sans)",
      color: "var(--text-primary)"
    }
  }, title || "오프라인이에요"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 var(--type-caption-size)/var(--type-caption-lh) var(--font-sans)",
      color: "var(--text-secondary)"
    }
  }, description || (pendingCount > 0 ? `기록 ${pendingCount}건이 저장되어 있고, 연결되면 자동으로 올려드려요.` : "기록은 이 기기에 안전하게 저장돼요."))));
}
Object.assign(__ds_scope, { OfflineState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/OfflineState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Skeleton.jsx
try { (() => {
function Skeleton({
  width = "100%",
  height = 16,
  radius = "var(--radius-sm)",
  circle = false,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: "block",
      width: circle ? height : width,
      height,
      borderRadius: circle ? "50%" : radius,
      background: "linear-gradient(90deg,var(--warm-100) 25%,var(--warm-50) 50%,var(--warm-100) 75%)",
      backgroundSize: "200% 100%",
      animation: "ds-shimmer 1.4s ease infinite",
      ...style
    }
  }, /*#__PURE__*/React.createElement("style", null, "@keyframes ds-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}"));
}
Object.assign(__ds_scope, { Skeleton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Skeleton.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Snackbar.jsx
try { (() => {
function Snackbar({
  message,
  tone = "success",
  actionLabel,
  onAction,
  style
}) {
  const err = tone === "error";
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "var(--space-3) var(--space-4)",
      background: "var(--bg-inverse)",
      color: "var(--text-inverse)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-overlay)",
      fontFamily: "var(--font-sans)",
      maxWidth: 420,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    className: `mdi mdi-${err ? "alert-circle-outline" : "check-circle-outline"}`,
    style: {
      fontSize: "var(--size-icon-md)",
      color: err ? "#FF8F84" : "#7BD8AE"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: "400 var(--type-body-md-size)/var(--type-body-md-lh) var(--font-sans)"
    }
  }, message), actionLabel ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onAction,
    style: {
      border: "none",
      background: "transparent",
      color: "var(--brand-300)",
      font: "700 var(--type-label-md-size)/1 var(--font-sans)",
      cursor: "pointer",
      minHeight: 32,
      padding: "0 var(--space-2)"
    }
  }, actionLabel) : null);
}
Object.assign(__ds_scope, { Snackbar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Snackbar.jsx", error: String((e && e.message) || e) }); }

// components/feedback/SyncStatusBar.jsx
try { (() => {
const STATES = {
  synced: {
    icon: "check-circle-outline",
    bg: "var(--status-success-surface)",
    fg: "var(--status-success-content)",
    text: "모든 기록이 동기화됐어요"
  },
  pending: {
    icon: "cloud-upload-outline",
    bg: "var(--status-info-surface)",
    fg: "var(--status-info-content)",
    text: "동기화 대기 중이에요"
  },
  conflict: {
    icon: "alert-circle-outline",
    bg: "var(--status-warning-surface)",
    fg: "var(--status-warning-content)",
    text: "확인이 필요한 기록이 있어요"
  }
};
function SyncStatusBar({
  status = "synced",
  label,
  count,
  onPress,
  style
}) {
  const s = STATES[status] || STATES.synced;
  const text = label || (count ? `${s.text.replace("이에요", "")} · ${count}건` : s.text);
  return /*#__PURE__*/React.createElement("div", {
    role: onPress ? "button" : undefined,
    onClick: onPress,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      minHeight: 40,
      padding: "0 var(--space-4)",
      background: s.bg,
      color: s.fg,
      borderRadius: "var(--radius-full)",
      font: "700 var(--type-caption-size)/1 var(--font-sans)",
      fontFamily: "var(--font-sans)",
      cursor: onPress ? "pointer" : undefined,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    className: `mdi mdi-${s.icon}`,
    style: {
      fontSize: 16
    }
  }), text, onPress ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    className: "mdi mdi-chevron-right",
    style: {
      marginLeft: "auto",
      fontSize: 16
    }
  }) : null);
}
Object.assign(__ds_scope, { SyncStatusBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/SyncStatusBar.jsx", error: String((e && e.message) || e) }); }

// components/forms/DateField.jsx
try { (() => {
const {
  useState
} = React;
function DateField({
  label,
  value,
  defaultValue,
  onChange,
  helper,
  error,
  disabled = false,
  style
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const val = value !== undefined ? value : inner;
  const [focus, setFocus] = useState(false);
  const border = error ? "var(--border-danger)" : focus ? "var(--border-focus)" : "var(--border-default)";
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      font: "var(--type-label-md-weight) var(--type-label-md-size)/var(--type-label-md-lh) var(--font-sans)",
      color: "var(--text-secondary)",
      ...style
    }
  }, label, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      height: "var(--size-input)",
      padding: "0 var(--space-4)",
      background: disabled ? "var(--bg-subtle)" : "var(--bg-surface)",
      border: `1.5px solid ${border}`,
      borderRadius: "var(--radius-md)",
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    className: "mdi mdi-calendar-blank-outline",
    style: {
      color: "var(--text-tertiary)",
      fontSize: "var(--size-icon-md)"
    }
  }), /*#__PURE__*/React.createElement("input", {
    type: "date",
    disabled: disabled,
    value: val,
    onChange: e => {
      if (value === undefined) setInner(e.target.value);
      onChange && onChange(e.target.value);
    },
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      font: "400 var(--type-body-lg-size)/var(--type-body-lg-lh) var(--font-sans)",
      color: disabled ? "var(--action-disabled-text)" : val ? "var(--text-primary)" : "var(--text-tertiary)"
    }
  })), error ? /*#__PURE__*/React.createElement("span", {
    role: "alert",
    style: {
      color: "var(--text-danger)",
      font: "400 var(--type-caption-size)/var(--type-caption-lh) var(--font-sans)"
    }
  }, error) : helper ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-tertiary)",
      font: "400 var(--type-caption-size)/var(--type-caption-lh) var(--font-sans)"
    }
  }, helper) : null);
}
Object.assign(__ds_scope, { DateField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/DateField.jsx", error: String((e && e.message) || e) }); }

// components/forms/MoneyField.jsx
try { (() => {
const {
  useState
} = React;
const fmt = n => n === null || n === undefined || n === "" ? "" : Number(n).toLocaleString("ko-KR");
function MoneyField({
  label,
  value,
  defaultValue,
  onChange,
  helper,
  error,
  disabled = false,
  style
}) {
  const [inner, setInner] = useState(defaultValue ?? null);
  const num = value !== undefined ? value : inner;
  const [focus, setFocus] = useState(false);
  const set = v => {
    const digits = v.replace(/[^\d]/g, "");
    const n = digits === "" ? null : Math.min(Number(digits), 999999999999);
    if (value === undefined) setInner(n);
    onChange && onChange(n);
  };
  const border = error ? "var(--border-danger)" : focus ? "var(--border-focus)" : "var(--border-default)";
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      font: "var(--type-label-md-weight) var(--type-label-md-size)/var(--type-label-md-lh) var(--font-sans)",
      color: "var(--text-secondary)",
      ...style
    }
  }, label, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      height: "var(--size-input)",
      padding: "0 var(--space-4)",
      background: disabled ? "var(--bg-subtle)" : "var(--bg-surface)",
      border: `1.5px solid ${border}`,
      borderRadius: "var(--radius-md)",
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement("input", {
    inputMode: "numeric",
    pattern: "[0-9,]*",
    disabled: disabled,
    value: fmt(num),
    onChange: e => set(e.target.value),
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      textAlign: "right",
      fontVariantNumeric: "tabular-nums",
      font: "700 var(--type-money-md-size)/var(--type-money-md-lh) var(--font-sans)",
      color: disabled ? "var(--action-disabled-text)" : "var(--text-primary)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-secondary)",
      font: "400 var(--type-body-md-size) var(--font-sans)"
    }
  }, "\uC6D0")), error ? /*#__PURE__*/React.createElement("span", {
    role: "alert",
    style: {
      color: "var(--text-danger)",
      font: "400 var(--type-caption-size)/var(--type-caption-lh) var(--font-sans)"
    }
  }, error) : helper ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-tertiary)",
      font: "400 var(--type-caption-size)/var(--type-caption-lh) var(--font-sans)"
    }
  }, helper) : null);
}
Object.assign(__ds_scope, { MoneyField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/MoneyField.jsx", error: String((e && e.message) || e) }); }

// components/forms/TextField.jsx
try { (() => {
const {
  useState
} = React;
function TextField({
  label,
  value,
  defaultValue,
  onChange,
  placeholder,
  helper,
  error,
  clearable = true,
  disabled = false,
  type = "text",
  inputMode,
  suffix,
  style
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const val = value !== undefined ? value : inner;
  const set = v => {
    if (value === undefined) setInner(v);
    onChange && onChange(v);
  };
  const [focus, setFocus] = useState(false);
  const border = error ? "var(--border-danger)" : focus ? "var(--border-focus)" : "var(--border-default)";
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      font: "var(--type-label-md-weight) var(--type-label-md-size)/var(--type-label-md-lh) var(--font-sans)",
      color: "var(--text-secondary)",
      ...style
    }
  }, label, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      height: "var(--size-input)",
      padding: "0 var(--space-4)",
      background: disabled ? "var(--bg-subtle)" : "var(--bg-surface)",
      border: `1.5px solid ${border}`,
      borderRadius: "var(--radius-md)",
      transition: "border-color var(--duration-fast) var(--ease-standard)",
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: type,
    inputMode: inputMode,
    disabled: disabled,
    placeholder: placeholder,
    value: val,
    onChange: e => set(e.target.value),
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      font: "400 var(--type-body-lg-size)/var(--type-body-lg-lh) var(--font-sans)",
      color: disabled ? "var(--action-disabled-text)" : "var(--text-primary)"
    }
  }), suffix ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-tertiary)",
      font: "400 var(--type-body-md-size) var(--font-sans)"
    }
  }, suffix) : null, clearable && val && !disabled ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "\uC9C0\uC6B0\uAE30",
    onClick: () => set(""),
    style: {
      border: "none",
      background: "var(--warm-200)",
      color: "var(--warm-600)",
      width: 20,
      height: 20,
      borderRadius: "50%",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 12,
      padding: 0
    }
  }, "\u2715") : null), error ? /*#__PURE__*/React.createElement("span", {
    role: "alert",
    style: {
      color: "var(--text-danger)",
      font: "400 var(--type-caption-size)/var(--type-caption-lh) var(--font-sans)"
    }
  }, error) : helper ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-tertiary)",
      font: "400 var(--type-caption-size)/var(--type-caption-lh) var(--font-sans)"
    }
  }, helper) : null);
}
Object.assign(__ds_scope, { TextField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/TextField.jsx", error: String((e && e.message) || e) }); }

// components/overlay/BottomSheet.jsx
try { (() => {
function BottomSheet({
  title,
  children,
  action,
  onClose,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-label": title,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-4)",
      padding: "var(--space-5) var(--space-5) var(--space-6)",
      background: "var(--bg-surface)",
      borderRadius: "var(--radius-2xl) var(--radius-2xl) 0 0",
      boxShadow: "var(--shadow-overlay)",
      fontFamily: "var(--font-sans)",
      boxSizing: "border-box",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      alignSelf: "center",
      width: 42,
      height: 4,
      borderRadius: "var(--radius-full)",
      background: "var(--warm-200)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: "700 var(--type-heading-md-size)/var(--type-heading-md-lh) var(--font-sans)",
      color: "var(--text-primary)"
    }
  }, title), onClose ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "\uB2EB\uAE30",
    onClick: onClose,
    style: {
      border: "none",
      background: "transparent",
      cursor: "pointer",
      width: 32,
      height: 32,
      color: "var(--text-secondary)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mdi mdi-close",
    style: {
      fontSize: 20
    }
  })) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)"
    }
  }, children), action ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "sticky",
      bottom: 0,
      paddingTop: "var(--space-2)",
      background: "var(--bg-surface)"
    }
  }, action) : null);
}
Object.assign(__ds_scope, { BottomSheet });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlay/BottomSheet.jsx", error: String((e && e.message) || e) }); }

// components/overlay/Dialog.jsx
try { (() => {
function Dialog({
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  destructive = false,
  onConfirm,
  onCancel,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "alertdialog",
    "aria-label": title,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)",
      width: 320,
      padding: "var(--space-5)",
      background: "var(--bg-surface)",
      borderRadius: "var(--radius-xl)",
      boxShadow: "var(--shadow-overlay)",
      fontFamily: "var(--font-sans)",
      boxSizing: "border-box",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "700 var(--type-heading-md-size)/var(--type-heading-md-lh) var(--font-sans)",
      color: "var(--text-primary)"
    }
  }, title), description ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 var(--type-body-md-size)/var(--type-body-md-lh) var(--font-sans)",
      color: "var(--text-secondary)"
    }
  }, description) : null, children, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: "var(--space-2)"
    }
  }, cancelLabel ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "secondary",
    size: "medium",
    style: {
      flex: 1
    },
    onClick: onCancel
  }, cancelLabel) : null, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: destructive ? "destructive" : "primary",
    size: "medium",
    style: {
      flex: 1
    },
    onClick: onConfirm
  }, confirmLabel)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlay/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/selection/CheckCard.jsx
try { (() => {
function CheckCard({
  checked = false,
  onChange,
  label,
  icon,
  layout = "row",
  disabled = false,
  style
}) {
  const grid = layout === "grid";
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "checkbox",
    "aria-checked": checked,
    disabled: disabled,
    onClick: () => onChange && onChange(!checked),
    style: {
      display: "flex",
      flexDirection: grid ? "column" : "row",
      alignItems: "center",
      justifyContent: grid ? "center" : "flex-start",
      gap: grid ? 8 : 12,
      width: "100%",
      minHeight: "var(--size-touch-min)",
      minWidth: grid ? 88 : undefined,
      padding: grid ? "var(--space-3)" : "var(--space-4)",
      textAlign: grid ? "center" : "left",
      position: "relative",
      background: checked ? "var(--action-primary-soft)" : "var(--bg-surface)",
      border: `1.5px solid ${checked ? "var(--action-primary)" : "var(--border-default)"}`,
      borderRadius: "var(--radius-lg)",
      cursor: disabled ? "default" : "pointer",
      transition: "border-color var(--duration-fast) var(--ease-standard),background var(--duration-fast) var(--ease-standard)",
      boxSizing: "border-box",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: 22,
      height: 22,
      flex: "none",
      borderRadius: 6,
      border: `1.5px solid ${checked ? "var(--action-primary)" : "var(--border-strong)"}`,
      background: checked ? "var(--action-primary)" : "var(--bg-surface)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--text-inverse)",
      fontSize: 14,
      fontWeight: 800,
      position: grid ? "absolute" : "static",
      top: grid ? 8 : undefined,
      right: grid ? 8 : undefined
    }
  }, checked ? "✓" : ""), icon ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    className: `mdi mdi-${icon}`,
    style: {
      fontSize: grid ? "var(--size-icon-xl)" : "var(--size-icon-lg)",
      color: checked ? "var(--text-brand)" : "var(--text-secondary)"
    }
  }) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "700 var(--type-label-md-size)/var(--type-label-md-lh) var(--font-sans)",
      color: "var(--text-primary)",
      overflowWrap: "break-word"
    }
  }, label));
}
Object.assign(__ds_scope, { CheckCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/selection/CheckCard.jsx", error: String((e && e.message) || e) }); }

// components/selection/FilterChip.jsx
try { (() => {
function FilterChip({
  selected = false,
  onChange,
  label,
  disabled = false,
  style
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-pressed": selected,
    disabled: disabled,
    onClick: () => onChange && onChange(!selected),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: 36,
      padding: "0 var(--space-4)",
      margin: "6px 0",
      background: selected ? "var(--action-primary)" : "var(--bg-surface)",
      color: selected ? "var(--action-primary-text)" : "var(--text-primary)",
      border: `1px solid ${selected ? "var(--action-primary)" : "var(--border-strong)"}`,
      borderRadius: "var(--radius-full)",
      font: "700 var(--type-label-md-size)/1 var(--font-sans)",
      whiteSpace: "nowrap",
      cursor: disabled ? "default" : "pointer",
      transition: "background var(--duration-fast) var(--ease-standard)",
      boxSizing: "border-box",
      ...style
    }
  }, selected ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    className: "mdi mdi-check",
    style: {
      fontSize: "var(--size-icon-sm)"
    }
  }) : null, label);
}
Object.assign(__ds_scope, { FilterChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/selection/FilterChip.jsx", error: String((e && e.message) || e) }); }

// components/selection/RadioCard.jsx
try { (() => {
function RadioCard({
  checked = false,
  onChange,
  title,
  description,
  icon,
  disabled = false,
  style
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "radio",
    "aria-checked": checked,
    disabled: disabled,
    onClick: () => onChange && onChange(true),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      width: "100%",
      minHeight: "var(--size-touch-min)",
      padding: "var(--space-4)",
      textAlign: "left",
      background: checked ? "var(--action-primary-soft)" : "var(--bg-surface)",
      border: `1.5px solid ${checked ? "var(--action-primary)" : "var(--border-default)"}`,
      borderRadius: "var(--radius-lg)",
      cursor: disabled ? "default" : "pointer",
      transition: "border-color var(--duration-fast) var(--ease-standard),background var(--duration-fast) var(--ease-standard)",
      boxSizing: "border-box",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: 22,
      height: 22,
      flex: "none",
      borderRadius: "50%",
      border: `2px solid ${checked ? "var(--action-primary)" : "var(--border-strong)"}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg-surface)"
    }
  }, checked ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 11,
      height: 11,
      borderRadius: "50%",
      background: "var(--action-primary)"
    }
  }) : null), icon ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    className: `mdi mdi-${icon}`,
    style: {
      fontSize: "var(--size-icon-lg)",
      color: checked ? "var(--text-brand)" : "var(--text-secondary)"
    }
  }) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "700 var(--type-label-lg-size)/var(--type-label-lg-lh) var(--font-sans)",
      color: "var(--text-primary)"
    }
  }, title), description ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 var(--type-caption-size)/var(--type-caption-lh) var(--font-sans)",
      color: "var(--text-secondary)"
    }
  }, description) : null));
}
Object.assign(__ds_scope, { RadioCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/selection/RadioCard.jsx", error: String((e && e.message) || e) }); }

// components/selection/SegmentedTabs.jsx
try { (() => {
function SegmentedTabs({
  options,
  value,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: "flex",
      padding: 4,
      background: "var(--warm-100)",
      borderRadius: "var(--radius-full)",
      ...style
    }
  }, options.map(o => {
    const on = o === value;
    return /*#__PURE__*/React.createElement("button", {
      key: o,
      type: "button",
      role: "tab",
      "aria-selected": on,
      onClick: () => onChange && onChange(o),
      style: {
        flex: 1,
        minHeight: 40,
        border: "none",
        borderRadius: "var(--radius-full)",
        background: on ? "var(--action-primary)" : "transparent",
        color: on ? "var(--action-primary-text)" : "var(--text-secondary)",
        font: "700 var(--type-label-md-size)/1 var(--font-sans)",
        cursor: "pointer",
        transition: "background var(--duration-standard) var(--ease-standard)"
      }
    }, o);
  }));
}
Object.assign(__ds_scope, { SegmentedTabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/selection/SegmentedTabs.jsx", error: String((e && e.message) || e) }); }

// components/selection/StatusChip.jsx
try { (() => {
const TONES = {
  neutral: {
    bg: "var(--bg-subtle)",
    fg: "var(--text-secondary)",
    icon: "circle-outline"
  },
  info: {
    bg: "var(--status-info-surface)",
    fg: "var(--status-info-content)",
    icon: "information-outline"
  },
  success: {
    bg: "var(--status-success-surface)",
    fg: "var(--status-success-content)",
    icon: "check-circle-outline"
  },
  warning: {
    bg: "var(--status-warning-surface)",
    fg: "var(--status-warning-content)",
    icon: "alert-circle-outline"
  },
  danger: {
    bg: "var(--status-danger-surface)",
    fg: "var(--status-danger-content)",
    icon: "close-circle-outline"
  },
  review: {
    bg: "var(--status-review-surface)",
    fg: "var(--status-review-content)",
    icon: "shield-search"
  },
  brand: {
    bg: "var(--action-primary-soft)",
    fg: "var(--text-brand)",
    icon: "heart-outline"
  }
};
function StatusChip({
  tone = "neutral",
  label,
  icon,
  style
}) {
  const t = TONES[tone] || TONES.neutral;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "5px 10px",
      background: t.bg,
      color: t.fg,
      borderRadius: "var(--radius-full)",
      font: "700 var(--type-caption-size)/1 var(--font-sans)",
      whiteSpace: "nowrap",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    className: `mdi mdi-${icon || t.icon}`,
    style: {
      fontSize: 14,
      lineHeight: 1
    }
  }), label);
}
Object.assign(__ds_scope, { StatusChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/selection/StatusChip.jsx", error: String((e && e.message) || e) }); }

// components/domain/PreparationItemCard.jsx
try { (() => {
const STATUS_TONE = {
  "알아보기": "neutral",
  "예정": "info",
  "주문": "info",
  "보유": "success",
  "대여": "review",
  "선물": "brand",
  "교체": "warning",
  "종료": "neutral"
};
function PreparationItemCard({
  icon,
  name,
  status = "알아보기",
  meta,
  checked,
  onPress,
  style
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onPress,
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
      minWidth: 88,
      padding: "var(--space-3)",
      background: "var(--bg-surface)",
      border: `1.5px solid ${checked ? "var(--action-primary)" : "var(--border-default)"}`,
      borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-1)",
      cursor: onPress ? "pointer" : "default",
      textAlign: "center",
      fontFamily: "var(--font-sans)",
      transition: "border-color var(--duration-fast) var(--ease-standard)",
      boxSizing: "border-box",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: 44,
      height: 44,
      borderRadius: "50%",
      background: "var(--action-primary-soft)",
      color: "var(--text-brand)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: `mdi mdi-${icon}`,
    style: {
      fontSize: "var(--size-icon-lg)",
      lineHeight: 1
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "700 var(--type-label-md-size)/var(--type-label-md-lh) var(--font-sans)",
      color: "var(--text-primary)",
      overflowWrap: "break-word"
    }
  }, name), /*#__PURE__*/React.createElement(__ds_scope.StatusChip, {
    tone: STATUS_TONE[status] || "neutral",
    label: status
  }), meta ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 var(--type-caption-size)/var(--type-caption-lh) var(--font-sans)",
      color: "var(--text-tertiary)"
    }
  }, meta) : null);
}
Object.assign(__ds_scope, { PreparationItemCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/domain/PreparationItemCard.jsx", error: String((e && e.message) || e) }); }

// components/shell/BottomNavigation.jsx
try { (() => {
const TABS = [{
  key: "홈",
  icon: "home-outline",
  iconActive: "home"
}, {
  key: "기록",
  icon: "notebook-outline",
  iconActive: "notebook"
}, {
  key: "준비템",
  icon: "basket-outline",
  iconActive: "basket"
}, {
  key: "리포트",
  icon: "chart-box-outline",
  iconActive: "chart-box"
}, {
  key: "프로필",
  icon: "account-circle-outline",
  iconActive: "account-circle"
}];
function BottomNavigation({
  active = "홈",
  onSelect,
  tabs,
  style
}) {
  const list = tabs || TABS;
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      height: "var(--size-bottomnav)",
      background: "var(--bg-surface)",
      borderTop: "1px solid var(--border-default)",
      fontFamily: "var(--font-sans)",
      ...style
    }
  }, list.map(t => {
    const on = t.key === active;
    return /*#__PURE__*/React.createElement("button", {
      key: t.key,
      type: "button",
      "aria-current": on ? "page" : undefined,
      onClick: () => onSelect && onSelect(t.key),
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        color: on ? "var(--action-primary)" : "var(--text-secondary)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      className: `mdi mdi-${on ? t.iconActive || t.icon : t.icon}`,
      style: {
        fontSize: "var(--size-icon-lg)",
        lineHeight: 1
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        font: `700 11px/1.4 var(--font-sans)`
      }
    }, t.key));
  }));
}
Object.assign(__ds_scope, { BottomNavigation });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shell/BottomNavigation.jsx", error: String((e && e.message) || e) }); }

// components/shell/ChildContextSwitcher.helpers.js
try { (() => {
// Trivial passthrough kept as a helper seam for future stage-name localization.
function StageBadgeLabel(label) {
  return label;
}
Object.assign(__ds_scope, { StageBadgeLabel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shell/ChildContextSwitcher.helpers.js", error: String((e && e.message) || e) }); }

// components/shell/ChildContextSwitcher.jsx
try { (() => {
function ChildContextSwitcher({
  name,
  stageLabel,
  onPress,
  style
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onPress,
    "aria-label": `${name} 프로필, 아이 전환`,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      minHeight: "var(--size-touch-min)",
      padding: "var(--space-1) var(--space-2)",
      margin: "calc(-1 * var(--space-1)) calc(-1 * var(--space-2))",
      border: "none",
      background: "transparent",
      cursor: "pointer",
      fontFamily: "var(--font-sans)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "700 var(--type-heading-lg-size)/var(--type-heading-lg-lh) var(--font-sans)",
      letterSpacing: "var(--type-heading-lg-ls)",
      color: "var(--text-primary)"
    }
  }, name), stageLabel ? /*#__PURE__*/React.createElement("span", {
    style: {
      padding: "5px 12px",
      borderRadius: "var(--radius-full)",
      background: "var(--brand-50)",
      color: "var(--brand-700)",
      font: "700 var(--type-caption-size)/1 var(--font-sans)"
    }
  }, __ds_scope.StageBadgeLabel(stageLabel)) : null, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    className: "mdi mdi-chevron-down",
    style: {
      fontSize: "var(--size-icon-md)",
      color: "var(--text-secondary)"
    }
  }));
}
Object.assign(__ds_scope, { ChildContextSwitcher });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shell/ChildContextSwitcher.jsx", error: String((e && e.message) || e) }); }

// components/shell/ScreenScaffold.jsx
try { (() => {
function ScreenScaffold({
  width = 390,
  height,
  padded = true,
  children,
  footer,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width,
      height,
      maxWidth: "var(--layout-content-max)",
      display: "flex",
      flexDirection: "column",
      background: "var(--bg-canvas)",
      fontFamily: "var(--font-sans)",
      overflow: "hidden",
      boxSizing: "border-box",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      overflowY: "auto",
      scrollbarWidth: "none",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-5)",
      padding: padded ? "var(--space-4) var(--layout-pad-large) var(--space-6)" : 0
    }
  }, children), footer);
}
Object.assign(__ds_scope, { ScreenScaffold });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shell/ScreenScaffold.jsx", error: String((e && e.message) || e) }); }

// components/shell/TopAppBar.jsx
try { (() => {
function TopAppBar({
  title,
  eyebrow,
  onBack,
  actions,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      minHeight: "var(--size-appbar)",
      fontFamily: "var(--font-sans)",
      ...style
    }
  }, onBack ? /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "chevron-left",
    label: "\uB4A4\uB85C\uAC00\uAE30",
    onClick: onBack,
    style: {
      marginLeft: -12
    }
  }) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column"
    }
  }, eyebrow ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "700 var(--type-caption-size)/var(--type-caption-lh) var(--font-sans)",
      color: "var(--text-brand)"
    }
  }, eyebrow) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "700 var(--type-heading-lg-size)/var(--type-heading-lg-lh) var(--font-sans)",
      letterSpacing: "var(--type-heading-lg-ls)",
      color: "var(--text-primary)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, title)), (actions || []).slice(0, 2));
}
Object.assign(__ds_scope, { TopAppBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shell/TopAppBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile/HomeScreen.jsx
try { (() => {
const DSh = window.DesignSystem_063d12;
function HomeScreen({
  go
}) {
  const {
    ScreenScaffold,
    ChildContextSwitcher,
    IconButton,
    BudgetSummary,
    Card,
    ListRow,
    SyncStatusBar,
    MoneyText,
    StatusChip
  } = DSh;
  const Quick = ({
    icon,
    label,
    onClick
  }) => /*#__PURE__*/React.createElement("div", {
    role: "button",
    onClick: onClick,
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      cursor: "pointer",
      minHeight: 68
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 16,
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      boxShadow: "var(--shadow-1)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--text-primary)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: `mdi mdi-${icon}`,
    style: {
      fontSize: 20
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "700 11px/1.4 var(--font-sans)",
      color: "var(--text-primary)"
    }
  }, label));
  return /*#__PURE__*/React.createElement(ScreenScaffold, {
    width: "100%",
    height: "100%"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 4
    }
  }, /*#__PURE__*/React.createElement(ChildContextSwitcher, {
    name: "\uB2E4\uC628\uC774",
    stageLabel: "\uC784\uC2E0 28\uC8FC"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: "bell-outline",
    label: "\uC54C\uB9BC"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 13px/19px var(--font-sans)",
      color: "var(--text-secondary)",
      marginTop: -12
    }
  }, "\uC6B0\uB9AC \uC544\uC774\uC5D0\uAC8C \uD574\uC900 \uAC83\uC744 \uB530\uB73B\uD558\uAC8C \uAE30\uB85D\uD574\uC694."), /*#__PURE__*/React.createElement(BudgetSummary, {
    usedKrw: 389700,
    budgetKrw: 500000,
    label: "\uC774\uBC88 \uB2EC \uC9C0\uCD9C"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Quick, {
    icon: "pencil-plus-outline",
    label: "\uC9C0\uCD9C \uAE30\uB85D",
    onClick: () => go("기록")
  }), /*#__PURE__*/React.createElement(Quick, {
    icon: "basket-outline",
    label: "\uC900\uBE44\uD15C",
    onClick: () => go("준비템")
  }), /*#__PURE__*/React.createElement(Quick, {
    icon: "chart-box-outline",
    label: "\uB9AC\uD3EC\uD2B8",
    onClick: () => go("리포트")
  }), /*#__PURE__*/React.createElement(Quick, {
    icon: "account-multiple-outline",
    label: "\uAC00\uC871"
  })), /*#__PURE__*/React.createElement(Card, {
    onClick: () => go("준비템"),
    style: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 40,
      height: 40,
      flex: "none",
      borderRadius: 14,
      background: "var(--brand-50)",
      color: "var(--brand-600)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mdi mdi-clipboard-check-outline",
    style: {
      fontSize: 20
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "800 14px/1.4 var(--font-sans)"
    }
  }, "\uC9C0\uAE08 \uC900\uBE44\uD560 \uAC83 3\uAC1C\uAC00 \uC788\uC5B4\uC694"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 12px/18px var(--font-sans)",
      color: "var(--text-secondary)"
    }
  }, "\uC784\uC2E0 \uD6C4\uAE30 \u2014 \uCD9C\uC0B0 \uAC00\uBC29\uC744 \uCC59\uACA8\uBCFC\uAE4C\uC694?")), /*#__PURE__*/React.createElement("span", {
    className: "mdi mdi-chevron-right",
    style: {
      fontSize: 22,
      color: "var(--text-tertiary)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "700 18px/1.4 var(--font-sans)"
    }
  }, "\uCD5C\uADFC \uC9C0\uCD9C"), /*#__PURE__*/React.createElement("span", {
    role: "button",
    onClick: () => go("기록"),
    style: {
      font: "700 12px/1 var(--font-sans)",
      color: "var(--text-secondary)",
      cursor: "pointer"
    }
  }, "\uC804\uCCB4 \uBCF4\uAE30")), /*#__PURE__*/React.createElement(Card, {
    style: {
      gap: 0
    }
  }, /*#__PURE__*/React.createElement(ListRow, {
    icon: "hospital-box-outline",
    iconBg: "var(--cat-6)",
    iconColor: "var(--warm-700)",
    title: "\uC0B0\uC804 \uAC80\uC9C4",
    subtitle: "\uC624\uB298",
    value: "45,000\uC6D0"
  }), /*#__PURE__*/React.createElement(ListRow, {
    icon: "pill",
    iconBg: "var(--cat-9)",
    iconColor: "var(--warm-700)",
    title: "\uCCA0\uBD84\uC81C",
    subtitle: "07.15",
    value: "32,400\uC6D0"
  }), /*#__PURE__*/React.createElement(ListRow, {
    icon: "tshirt-crew-outline",
    iconBg: "var(--cat-3)",
    iconColor: "var(--warm-700)",
    title: "\uBC30\uB0C7\uC800\uACE0\uB9AC",
    subtitle: "07.12",
    value: "28,900\uC6D0",
    badge: /*#__PURE__*/React.createElement(StatusChip, {
      tone: "success",
      label: "\uBCF4\uC720"
    })
  })), /*#__PURE__*/React.createElement(SyncStatusBar, {
    status: "synced"
  }));
}
window.WooriKit_HomeScreen = HomeScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile/HomeScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile/ItemsScreen.jsx
try { (() => {
const DSi = window.DesignSystem_063d12;
function ItemsScreen() {
  const {
    ScreenScaffold,
    TopAppBar,
    SegmentedTabs,
    FilterChip,
    PreparationItemCard,
    ItemStatusControl,
    BottomSheet,
    Button
  } = DSi;
  const [tab, setTab] = React.useState("맞춤");
  const [sheet, setSheet] = React.useState(null);
  const [status, setStatus] = React.useState("알아보기");
  const items = [["baby-carriage", "유모차", "알아보기", "외출 시기부터"], ["car-child-seat", "카시트", "예정", "퇴원 시 필수"], ["baby-bottle-outline", "젖병", "보유", null], ["bed-outline", "아기 침대", "주문", null], ["cradle-outline", "속싸개", "보유", null], ["thermometer", "체온계", "알아보기", "신생아 필수"], ["bathtub-outline", "아기 욕조", "알아보기", null], ["tshirt-crew-outline", "배냇저고리", "보유", null], ["hand-wash-outline", "손수건", "예정", null]];
  return /*#__PURE__*/React.createElement(ScreenScaffold, {
    width: "100%",
    height: "100%"
  }, /*#__PURE__*/React.createElement(TopAppBar, {
    title: "\uC900\uBE44\uD15C"
  }), /*#__PURE__*/React.createElement(SegmentedTabs, {
    options: ["맞춤", "전체", "내 준비함"],
    value: tab,
    onChange: setTab
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      margin: "-6px 0"
    }
  }, /*#__PURE__*/React.createElement(FilterChip, {
    label: "\uC784\uC2E0 \uD6C4\uAE30",
    selected: true
  }), /*#__PURE__*/React.createElement(FilterChip, {
    label: "\uC2E0\uC0DD\uC544"
  }), /*#__PURE__*/React.createElement(FilterChip, {
    label: "\uC548\uC804 \uC778\uC99D"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: 8
    }
  }, items.map(([ic, n, st, meta]) => /*#__PURE__*/React.createElement(PreparationItemCard, {
    key: n,
    icon: ic,
    name: n,
    status: st,
    meta: meta || undefined,
    onPress: () => {
      setStatus(st);
      setSheet(n);
    }
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 12px/18px var(--font-sans)",
      color: "var(--text-tertiary)"
    }
  }, "\uCC3E\uB294 \uD488\uBAA9\uC774 \uC5C6\uB098\uC694? ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault()
  }, "\uB204\uB77D \uC2E0\uACE0\uD558\uAE30")), sheet ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "rgba(33,30,28,0.4)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end",
      zIndex: 5
    },
    onClick: () => setSheet(null)
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement(BottomSheet, {
    title: sheet,
    onClose: () => setSheet(null),
    action: /*#__PURE__*/React.createElement(Button, {
      style: {
        width: "100%"
      },
      onClick: () => setSheet(null)
    }, "\uC800\uC7A5")
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 13px/20px var(--font-sans)",
      color: "var(--text-secondary)"
    }
  }, "\uC900\uBE44 \uC0C1\uD0DC\uB97C \uBC14\uAFB8\uBA74 \uBAA9\uB85D\uACFC \uB9AC\uD3EC\uD2B8\uC5D0 \uBC14\uB85C \uBC18\uC601\uB3FC\uC694."), /*#__PURE__*/React.createElement(ItemStatusControl, {
    value: status,
    onChange: setStatus
  })))) : null);
}
window.WooriKit_ItemsScreen = ItemsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile/ItemsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile/LoginScreen.jsx
try { (() => {
const DS = window.DesignSystem_063d12;
function LoginScreen({
  onLogin
}) {
  const {
    ScreenScaffold,
    Button,
    Card
  } = DS;
  const [terms, setTerms] = React.useState(false);
  const [privacy, setPrivacy] = React.useState(false);
  const ok = terms && privacy;
  const Consent = ({
    checked,
    label,
    onPress
  }) => /*#__PURE__*/React.createElement("div", {
    role: "checkbox",
    "aria-checked": checked,
    onClick: onPress,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      minHeight: 52,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 24,
      height: 24,
      borderRadius: 8,
      border: `1.5px solid ${checked ? "var(--action-primary)" : "var(--border-strong)"}`,
      background: checked ? "var(--action-primary)" : "var(--bg-surface)",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 14,
      fontWeight: 800
    }
  }, checked ? "✓" : ""), /*#__PURE__*/React.createElement("span", {
    style: {
      padding: "4px 8px",
      borderRadius: 999,
      background: "var(--brand-50)",
      color: "var(--brand-700)",
      font: "800 11px/1 var(--font-sans)"
    }
  }, "\uD544\uC218"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "700 15px/1.4 var(--font-sans)",
      color: "var(--text-primary)"
    }
  }, label));
  return /*#__PURE__*/React.createElement(ScreenScaffold, {
    width: "100%",
    height: "100%"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      paddingTop: 8
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo_mark.png",
    width: "44",
    height: "44",
    alt: "\uC6B0\uB9AC\uC544\uC774 \uB85C\uACE0"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "800 24px/1 var(--font-sans)",
      color: "var(--brand-600)"
    }
  }, "\uC6B0\uB9AC\uC544\uC774")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
      paddingTop: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "800 28px/37px var(--font-sans)",
      letterSpacing: "-0.3px",
      color: "var(--text-primary)"
    }
  }, "\uC6B0\uB9AC \uC544\uC774\uC758 \uAE30\uB85D\uC744 \uC2DC\uC791\uD574\uC694"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 15px/23px var(--font-sans)",
      color: "var(--text-secondary)"
    }
  }, "\uC900\uBE44\uBD80\uD130 \uC9C0\uCD9C\uAE4C\uC9C0, \uC9C0\uAE08 \uD544\uC694\uD55C \uAC83\uC744", /*#__PURE__*/React.createElement("br", null), "\uD55C \uD750\uB984\uC73C\uB85C \uAD00\uB9AC\uD574\uC694.")), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "800 18px/1.4 var(--font-sans)"
    }
  }, "\uC2DC\uC791 \uC804 \uB3D9\uC758\uD574 \uC8FC\uC138\uC694"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 13px/19px var(--font-sans)",
      color: "var(--text-secondary)"
    }
  }, "\uC11C\uBE44\uC2A4 \uC774\uC6A9\uC5D0 \uD544\uC694\uD55C \uD544\uC218 \uD56D\uBAA9\uC774\uC5D0\uC694."), /*#__PURE__*/React.createElement(Consent, {
    checked: terms,
    label: "\uC774\uC6A9\uC57D\uAD00 \uB3D9\uC758",
    onPress: () => setTerms(v => !v)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: "var(--border-default)"
    }
  }), /*#__PURE__*/React.createElement(Consent, {
    checked: privacy,
    label: "\uAC1C\uC778\uC815\uBCF4 \uC218\uC9D1\xB7\uC774\uC6A9 \uB3D9\uC758",
    onPress: () => setPrivacy(v => !v)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "auto",
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Button, {
    disabled: !ok,
    style: {
      width: "100%"
    },
    onClick: onLogin
  }, "\uCE74\uCE74\uC624\uB85C \uC2DC\uC791\uD558\uAE30"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 11px/17px var(--font-sans)",
      color: "var(--text-secondary)",
      textAlign: "center"
    }
  }, "\uB85C\uADF8\uC778\uD558\uBA74 \uD544\uC218 \uC57D\uAD00 \uB3D9\uC758\uAC00 \uACC4\uC815\uC5D0 \uC800\uC7A5\uB3FC\uC694.")));
}
window.WooriKit_LoginScreen = LoginScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile/LoginScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile/OnboardingFlow.jsx
try { (() => {
const DSo = window.DesignSystem_063d12;
const PREPARED_ITEMS = [["human-baby-changing-table", "기저귀"], ["bag-personal-outline", "아기띠"], ["toy-brick-outline", "원목 블록"], ["bed-outline", "아기 침대"], ["tshirt-crew-outline", "배냇저고리"], ["cradle-outline", "속싸개"], ["baby-bottle-outline", "젖병"], ["thermometer", "체온계"], ["bathtub-outline", "아기 욕조"], ["hand-wash-outline", "손수건"], ["car-child-seat", "카시트"], ["baby-carriage", "유모차"]];
function OnboardingFlow({
  onDone
}) {
  const {
    ScreenScaffold,
    TopAppBar,
    Button,
    RadioCard,
    CheckCard,
    TextField,
    DateField,
    MoneyField
  } = DSo;
  const [step, setStep] = React.useState(0);
  const [status, setStatus] = React.useState("pregnant");
  const [checked, setChecked] = React.useState(["기저귀", "아기띠"]);
  const [none, setNone] = React.useState(false);
  const steps = ["상태 선택", "아이 정보", "준비 현황", "월 예산"];
  const toggle = l => {
    setNone(false);
    setChecked(c => c.includes(l) ? c.filter(x => x !== l) : [...c, l]);
  };
  const Progress = () => /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, steps.map((s, i) => /*#__PURE__*/React.createElement("span", {
    key: s,
    style: {
      flex: 1,
      height: 4,
      borderRadius: 999,
      background: i <= step ? "var(--action-primary)" : "var(--warm-200)"
    }
  })));
  const Footer = ({
    label = "다음",
    disabled
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "auto"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    style: {
      width: "100%"
    },
    disabled: disabled,
    onClick: () => step < 3 ? setStep(step + 1) : onDone()
  }, label));
  return /*#__PURE__*/React.createElement(ScreenScaffold, {
    width: "100%",
    height: "100%"
  }, /*#__PURE__*/React.createElement(TopAppBar, {
    eyebrow: `${step + 1}/4 단계`,
    title: steps[step],
    onBack: step > 0 ? () => setStep(step - 1) : undefined
  }), /*#__PURE__*/React.createElement(Progress, null), step === 0 ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 15px/22px var(--font-sans)",
      color: "var(--text-secondary)"
    }
  }, "\uC9C0\uAE08 \uC0C1\uD669\uC744 \uC54C\uB824\uC8FC\uC2DC\uBA74 \uD544\uC694\uD55C \uC900\uBE44\uB97C \uC548\uB0B4\uD574\uC694."), /*#__PURE__*/React.createElement(RadioCard, {
    checked: status === "pregnant",
    onChange: () => setStatus("pregnant"),
    icon: "heart-outline",
    title: "\uC784\uC2E0 \uC911\uC774\uC5D0\uC694",
    description: "\uCD9C\uC0B0 \uC608\uC815\uC77C \uAE30\uC900\uC73C\uB85C \uC548\uB0B4\uD574\uC694"
  }), /*#__PURE__*/React.createElement(RadioCard, {
    checked: status === "born",
    onChange: () => setStatus("born"),
    icon: "baby-face-outline",
    title: "\uCD9C\uC0B0 \uD6C4\uC608\uC694",
    description: "\uC544\uC774 \uC0DD\uB144\uC6D4\uC77C \uAE30\uC900\uC73C\uB85C \uC548\uB0B4\uD574\uC694"
  }), /*#__PURE__*/React.createElement(RadioCard, {
    checked: status === "manual",
    onChange: () => setStatus("manual"),
    icon: "tune-variant",
    title: "\uC9C1\uC811 \uB2E8\uACC4\uB97C \uACE0\uB97C\uAC8C\uC694",
    description: "\uC0DD\uC560\uC8FC\uAE30 \uB2E8\uACC4\uB97C \uC9C1\uC811 \uC120\uD0DD\uD574\uC694"
  }), /*#__PURE__*/React.createElement(Footer, null)) : null, step === 1 ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(TextField, {
    label: "\uD0DC\uBA85 \xB7 \uC774\uB984",
    defaultValue: "\uB2E4\uC628\uC774",
    helper: "\uB098\uC911\uC5D0 \uC5B8\uC81C\uB4E0 \uBC14\uAFC0 \uC218 \uC788\uC5B4\uC694."
  }), /*#__PURE__*/React.createElement(DateField, {
    label: status === "pregnant" ? "출산 예정일" : "생년월일",
    defaultValue: "2026-10-05"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--space-3) var(--space-4)",
      background: "var(--brand-50)",
      borderRadius: 12,
      font: "400 13px/19px var(--font-sans)",
      color: "var(--brand-700)"
    }
  }, "\uC608\uC815\uC77C \uAE30\uC900 ", /*#__PURE__*/React.createElement("b", null, "\uC784\uC2E0 28\uC8FC"), " \u2014 \uC784\uC2E0 \uD6C4\uAE30 \uC900\uBE44\uB97C \uC548\uB0B4\uD560\uAC8C\uC694."), /*#__PURE__*/React.createElement(Footer, null)) : null, step === 2 ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 15px/22px var(--font-sans)",
      color: "var(--text-secondary)"
    }
  }, "\uC774\uBBF8 \uC900\uBE44\uD55C \uBB3C\uAC74\uC774 \uC788\uB098\uC694? \uCCB4\uD06C\uD55C \uD56D\uBAA9\uC740 \uC900\uBE44\uBB3C \uBAA9\uB85D\uC5D0\uC11C \uC644\uB8CC\uB85C \uD45C\uC2DC\uD560\uAC8C\uC694."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: 8
    }
  }, PREPARED_ITEMS.map(([ic, l]) => /*#__PURE__*/React.createElement(CheckCard, {
    key: l,
    layout: "grid",
    icon: ic,
    label: l,
    checked: checked.includes(l),
    onChange: () => toggle(l)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "medium",
    style: {
      flex: 1
    },
    onClick: () => {
      setChecked(PREPARED_ITEMS.map(x => x[1]));
      setNone(false);
    }
  }, "\uBAA8\uB450 \uC120\uD0DD"), /*#__PURE__*/React.createElement(Button, {
    variant: none ? "primary" : "secondary",
    size: "medium",
    style: {
      flex: 1
    },
    onClick: () => {
      setChecked([]);
      setNone(true);
    }
  }, "\uC900\uBE44\uD55C \uD56D\uBAA9 \uC5C6\uC74C")), /*#__PURE__*/React.createElement(Footer, {
    label: checked.length || none ? "다음" : "나중에 하기"
  })) : null, step === 3 ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(MoneyField, {
    label: "\uC6D4 \uC608\uC0B0",
    defaultValue: 500000,
    helper: "\uC5B8\uC81C\uB4E0 \uBC14\uAFC0 \uC218 \uC788\uC5B4\uC694. \uB9AC\uD3EC\uD2B8\uC5D0\uC11C \uC608\uC0B0 \uB300\uBE44 \uC9C0\uCD9C\uC744 \uBCF4\uC5EC\uB4DC\uB824\uC694."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--space-4)",
      background: "var(--bg-subtle)",
      borderRadius: 12,
      display: "flex",
      flexDirection: "column",
      gap: 6,
      font: "400 13px/20px var(--font-sans)",
      color: "var(--text-secondary)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "700 14px/1.4 var(--font-sans)",
      color: "var(--text-primary)"
    }
  }, "\uC785\uB825 \uD655\uC778"), /*#__PURE__*/React.createElement("span", null, "\uB2E4\uC628\uC774 \xB7 \uC784\uC2E0 28\uC8FC \xB7 \uC900\uBE44 ", none ? 0 : checked.length, "\uAC1C \uD56D\uBAA9 \xB7 \uC608\uC0B0 500,000\uC6D0")), /*#__PURE__*/React.createElement(Footer, {
    label: "\uC774\uB300\uB85C \uC2DC\uC791\uD558\uAE30"
  })) : null);
}
window.WooriKit_OnboardingFlow = OnboardingFlow;
window.WooriKit_PREPARED_ITEMS = PREPARED_ITEMS;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile/OnboardingFlow.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile/ProfileScreen.jsx
try { (() => {
const DSf = window.DesignSystem_063d12;
function ProfileScreen() {
  const {
    ScreenScaffold,
    TopAppBar,
    Card,
    ListRow,
    StatusChip,
    SyncStatusBar,
    Button
  } = DSf;
  const Section = ({
    t
  }) => /*#__PURE__*/React.createElement("span", {
    style: {
      font: "700 13px/1.4 var(--font-sans)",
      color: "var(--text-secondary)",
      marginBottom: -8
    }
  }, t);
  return /*#__PURE__*/React.createElement(ScreenScaffold, {
    width: "100%",
    height: "100%"
  }, /*#__PURE__*/React.createElement(TopAppBar, {
    title: "\uD504\uB85C\uD544"
  }), /*#__PURE__*/React.createElement(Card, {
    style: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 52,
      height: 52,
      flex: "none",
      borderRadius: "50%",
      background: "var(--brand-50)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo_mark.png",
    width: "34",
    height: "34",
    alt: ""
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "800 17px/1.4 var(--font-sans)"
    }
  }, "\uB2E4\uC628\uC774\uB124"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 12px/18px var(--font-sans)",
      color: "var(--text-secondary)"
    }
  }, "\uBCF4\uD638\uC790 2\uBA85 \xB7 \uC544\uC774 1\uBA85")), /*#__PURE__*/React.createElement(StatusChip, {
    tone: "brand",
    label: "\uC784\uC2E0 28\uC8FC"
  })), /*#__PURE__*/React.createElement(Section, {
    t: "\uC544\uC774 \xB7 \uC0B0\uBAA8"
  }), /*#__PURE__*/React.createElement(Card, {
    style: {
      gap: 0
    }
  }, /*#__PURE__*/React.createElement(ListRow, {
    icon: "baby-face-outline",
    title: "\uB2E4\uC628\uC774 (\uD0DC\uBA85)",
    subtitle: "\uC784\uC2E0 28\uC8FC \xB7 \uC608\uC815\uC77C 2026.10.05",
    badge: /*#__PURE__*/React.createElement(StatusChip, {
      tone: "success",
      label: "\uC120\uD0DD\uB428"
    }),
    onPress: () => {}
  }), /*#__PURE__*/React.createElement(ListRow, {
    icon: "heart-outline",
    title: "\uC0B0\uBAA8 \uD504\uB85C\uD544",
    subtitle: "\uD68C\uBCF5\xB7\uCF00\uC5B4 \uC900\uBE44 \uC548\uB0B4",
    onPress: () => {}
  }), /*#__PURE__*/React.createElement(ListRow, {
    icon: "plus-circle-outline",
    title: "\uC544\uC774 \uCD94\uAC00\uD558\uAE30",
    onPress: () => {}
  })), /*#__PURE__*/React.createElement(Section, {
    t: "\uAC00\uC871"
  }), /*#__PURE__*/React.createElement(Card, {
    style: {
      gap: 0
    }
  }, /*#__PURE__*/React.createElement(ListRow, {
    icon: "account-multiple-outline",
    title: "\uAC00\uC871 \uAD6C\uC131\uC6D0",
    subtitle: "\uC5C4\uB9C8(\uB098), \uC544\uBE60",
    value: "2\uBA85",
    onPress: () => {}
  }), /*#__PURE__*/React.createElement(ListRow, {
    icon: "email-outline",
    title: "\uAC00\uC871 \uCD08\uB300",
    subtitle: "\uCD08\uB300 \uB9C1\uD06C\uB85C \uC9C0\uCD9C\uC744 \uD568\uAED8 \uAE30\uB85D\uD574\uC694",
    onPress: () => {}
  })), /*#__PURE__*/React.createElement(Section, {
    t: "\uC608\uC0B0 \xB7 \uB370\uC774\uD130"
  }), /*#__PURE__*/React.createElement(Card, {
    style: {
      gap: 0
    }
  }, /*#__PURE__*/React.createElement(ListRow, {
    icon: "wallet-outline",
    title: "\uC6D4 \uC608\uC0B0 \uC124\uC815",
    value: "500,000\uC6D0",
    onPress: () => {}
  }), /*#__PURE__*/React.createElement(ListRow, {
    icon: "file-export-outline",
    title: "\uC9C0\uCD9C \uB0B4\uC5ED \uAC00\uC838\uC624\uAE30 \xB7 \uB0B4\uBCF4\uB0B4\uAE30",
    subtitle: "\uC5D1\uC140 \uD30C\uC77C \uC9C0\uC6D0",
    onPress: () => {}
  })), /*#__PURE__*/React.createElement(SyncStatusBar, {
    status: "synced"
  }), /*#__PURE__*/React.createElement(Section, {
    t: "\uC124\uC815"
  }), /*#__PURE__*/React.createElement(Card, {
    style: {
      gap: 0
    }
  }, /*#__PURE__*/React.createElement(ListRow, {
    icon: "bell-outline",
    title: "\uC54C\uB9BC \uC124\uC815",
    onPress: () => {}
  }), /*#__PURE__*/React.createElement(ListRow, {
    icon: "shield-lock-outline",
    title: "\uAC1C\uC778\uC815\uBCF4 \uCC98\uB9AC\uBC29\uCE68 \xB7 \uC57D\uAD00",
    onPress: () => {}
  }), /*#__PURE__*/React.createElement(ListRow, {
    icon: "information-outline",
    title: "\uC571 \uC815\uBCF4",
    value: "v1.0.0"
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "tertiary",
    style: {
      alignSelf: "center"
    }
  }, "\uB85C\uADF8\uC544\uC6C3"));
}
window.WooriKit_ProfileScreen = ProfileScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile/ProfileScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile/RecordsScreen.jsx
try { (() => {
const DSr = window.DesignSystem_063d12;
function RecordsScreen() {
  const {
    ScreenScaffold,
    TopAppBar,
    IconButton,
    TextField,
    FilterChip,
    Card,
    ListRow,
    Snackbar
  } = DSr;
  const [snack, setSnack] = React.useState(false);
  return /*#__PURE__*/React.createElement(ScreenScaffold, {
    width: "100%",
    height: "100%"
  }, /*#__PURE__*/React.createElement(TopAppBar, {
    title: "\uAE30\uB85D",
    actions: [/*#__PURE__*/React.createElement(IconButton, {
      key: "s",
      icon: "magnify",
      label: "\uAC80\uC0C9"
    })]
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "",
    placeholder: "\uD488\uBAA9\xB7\uBA54\uBAA8 \uAC80\uC0C9",
    clearable: false,
    style: {
      marginTop: -16
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      margin: "-6px 0"
    }
  }, /*#__PURE__*/React.createElement(FilterChip, {
    label: "\uC804\uCCB4",
    selected: true
  }), /*#__PURE__*/React.createElement(FilterChip, {
    label: "\uBCD1\uC6D0\xB7\uAC74\uAC15"
  }), /*#__PURE__*/React.createElement(FilterChip, {
    label: "\uAE30\uC800\uADC0\xB7\uC704\uC0DD"
  }), /*#__PURE__*/React.createElement(FilterChip, {
    label: "\uC758\uB958"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "700 13px/1.4 var(--font-sans)",
      color: "var(--text-secondary)"
    }
  }, "7\uC6D4 18\uC77C \uAE08\uC694\uC77C"), /*#__PURE__*/React.createElement(Card, {
    style: {
      gap: 0
    }
  }, /*#__PURE__*/React.createElement(ListRow, {
    icon: "hospital-box-outline",
    iconBg: "var(--cat-6)",
    iconColor: "var(--warm-700)",
    title: "\uC0B0\uC804 \uAC80\uC9C4",
    subtitle: "\uBCD1\uC6D0\xB7\uAC74\uAC15 \xB7 \uC5C4\uB9C8",
    value: "45,000\uC6D0",
    onPress: () => setSnack(true)
  }), /*#__PURE__*/React.createElement(ListRow, {
    icon: "food-apple-outline",
    iconBg: "var(--cat-2)",
    iconColor: "var(--warm-700)",
    title: "\uACFC\uC77C",
    subtitle: "\uC2DD\uBE44 \xB7 \uAC00\uC871",
    value: "18,600\uC6D0"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "700 13px/1.4 var(--font-sans)",
      color: "var(--text-secondary)"
    }
  }, "7\uC6D4 15\uC77C \uD654\uC694\uC77C"), /*#__PURE__*/React.createElement(Card, {
    style: {
      gap: 0
    }
  }, /*#__PURE__*/React.createElement(ListRow, {
    icon: "pill",
    iconBg: "var(--cat-9)",
    iconColor: "var(--warm-700)",
    title: "\uCCA0\uBD84\uC81C",
    subtitle: "\uC0B0\uBAA8 \uCF00\uC5B4",
    value: "32,400\uC6D0"
  }), /*#__PURE__*/React.createElement(ListRow, {
    icon: "tshirt-crew-outline",
    iconBg: "var(--cat-3)",
    iconColor: "var(--warm-700)",
    title: "\uBC30\uB0C7\uC800\uACE0\uB9AC",
    subtitle: "\uC758\uB958\xB7\uC7A1\uD654",
    value: "28,900\uC6D0"
  }), /*#__PURE__*/React.createElement(ListRow, {
    icon: "gift-outline",
    iconBg: "var(--cat-5)",
    iconColor: "var(--warm-700)",
    title: "\uC544\uAE30 \uBAA8\uBE4C (\uC120\uBB3C\uBC1B\uC74C)",
    subtitle: "\uC7A5\uB09C\uAC10\xB7\uB3C4\uC11C",
    value: "0\uC6D0"
  })), snack ? /*#__PURE__*/React.createElement(Snackbar, {
    message: "\uAE30\uB85D\uC744 \uC5F4 \uC218 \uC788\uC5B4\uC694. (\uD504\uB85C\uD1A0\uD0C0\uC785)",
    actionLabel: "\uB2EB\uAE30",
    onAction: () => setSnack(false)
  }) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "sticky",
      bottom: 12,
      alignSelf: "flex-end"
    }
  }, /*#__PURE__*/React.createElement("span", {
    role: "button",
    "aria-label": "\uC9C0\uCD9C \uAE30\uB85D \uCD94\uAC00",
    style: {
      width: 56,
      height: 56,
      borderRadius: 28,
      background: "var(--action-primary)",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "var(--shadow-2)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mdi mdi-plus",
    style: {
      fontSize: 28
    }
  }))));
}
window.WooriKit_RecordsScreen = RecordsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile/RecordsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/mobile/ReportsScreen.jsx
try { (() => {
const DSp = window.DesignSystem_063d12;
function ReportsScreen() {
  const {
    ScreenScaffold,
    TopAppBar,
    SegmentedTabs,
    PeriodNavigator,
    ChartContainer,
    MoneyText,
    AccessibleDataTable
  } = DSp;
  const [period, setPeriod] = React.useState("월");
  const data = [["병원·건강", 145000, 37], ["산모 케어", 98400, 25], ["의류·잡화", 67900, 17], ["식비·간식", 49800, 13], ["기타", 28600, 8]];
  const cats = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-6)"];
  return /*#__PURE__*/React.createElement(ScreenScaffold, {
    width: "100%",
    height: "100%"
  }, /*#__PURE__*/React.createElement(TopAppBar, {
    title: "\uB9AC\uD3EC\uD2B8"
  }), /*#__PURE__*/React.createElement(SegmentedTabs, {
    options: ["월", "분기", "연간"],
    value: period,
    onChange: setPeriod
  }), /*#__PURE__*/React.createElement(PeriodNavigator, {
    label: "2026\uB144 7\uC6D4",
    nextDisabled: true
  }), /*#__PURE__*/React.createElement(ChartContainer, {
    title: "\uC774\uBC88 \uB2EC \uC694\uC57D",
    recordCount: 9,
    summary: /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 4
      }
    }, /*#__PURE__*/React.createElement(MoneyText, {
      amount: 389700,
      size: "xl"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        font: "400 12px/18px var(--font-sans)",
        color: "var(--text-secondary)"
      }
    }, "\uC608\uC0B0 500,000\uC6D0\uC758 78% \xB7 \uC9C0\uB09C\uB2EC \uB300\uBE44 ", /*#__PURE__*/React.createElement("b", {
      style: {
        color: "var(--status-success-content)"
      }
    }, "-12%"))),
    tableColumns: ["카테고리", "금액", "비율"],
    tableRows: data.map(([c, a, p]) => [c, a.toLocaleString("ko-KR") + "원", p + "%"])
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, data.map(([c, a, p], i) => /*#__PURE__*/React.createElement("div", {
    key: c,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 2,
      background: cats[i],
      flex: "none"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 76,
      font: "400 12px/1.5 var(--font-sans)",
      color: "var(--text-secondary)"
    }
  }, c), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      height: 8,
      background: "var(--warm-100)",
      borderRadius: 999
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      width: p * 2.2 + "%",
      height: 8,
      background: cats[i],
      borderRadius: 999
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "600 12px/1 var(--font-sans)",
      fontVariantNumeric: "tabular-nums",
      width: 64,
      textAlign: "right"
    }
  }, a.toLocaleString("ko-KR"), "\uC6D0"))))), /*#__PURE__*/React.createElement(ChartContainer, {
    title: "\uC2E4\uC81C \uC9C0\uCD9C \uCD94\uC774",
    recordCount: 1,
    emptyTitle: "\uC544\uC9C1 \uCD94\uC774\uB97C \uBCF4\uC5EC\uB4DC\uB9B4 \uC218 \uC5C6\uC5B4\uC694",
    emptyDescription: "\uB450 \uB2EC \uC774\uC0C1 \uAE30\uB85D\uC774 \uBAA8\uC774\uBA74 \uC6D4\uBCC4 \uCD94\uC774\uB97C \uBCF4\uC5EC\uB4DC\uB824\uC694.",
    emptyCtaLabel: "\uC9C0\uCD9C \uAE30\uB85D\uD558\uAE30"
  }));
}
window.WooriKit_ReportsScreen = ReportsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mobile/ReportsScreen.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.ListRow = __ds_scope.ListRow;

__ds_ns.AccessibleDataTable = __ds_scope.AccessibleDataTable;

__ds_ns.ChartContainer = __ds_scope.ChartContainer;

__ds_ns.PeriodNavigator = __ds_scope.PeriodNavigator;

__ds_ns.BudgetSummary = __ds_scope.BudgetSummary;

__ds_ns.ItemStatusControl = __ds_scope.ItemStatusControl;

__ds_ns.MoneyText = __ds_scope.MoneyText;

__ds_ns.PreparationItemCard = __ds_scope.PreparationItemCard;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.ErrorState = __ds_scope.ErrorState;

__ds_ns.OfflineState = __ds_scope.OfflineState;

__ds_ns.Skeleton = __ds_scope.Skeleton;

__ds_ns.Snackbar = __ds_scope.Snackbar;

__ds_ns.SyncStatusBar = __ds_scope.SyncStatusBar;

__ds_ns.DateField = __ds_scope.DateField;

__ds_ns.MoneyField = __ds_scope.MoneyField;

__ds_ns.TextField = __ds_scope.TextField;

__ds_ns.BottomSheet = __ds_scope.BottomSheet;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.CheckCard = __ds_scope.CheckCard;

__ds_ns.FilterChip = __ds_scope.FilterChip;

__ds_ns.RadioCard = __ds_scope.RadioCard;

__ds_ns.SegmentedTabs = __ds_scope.SegmentedTabs;

__ds_ns.StatusChip = __ds_scope.StatusChip;

__ds_ns.BottomNavigation = __ds_scope.BottomNavigation;

__ds_ns.StageBadgeLabel = __ds_scope.StageBadgeLabel;

__ds_ns.ChildContextSwitcher = __ds_scope.ChildContextSwitcher;

__ds_ns.ScreenScaffold = __ds_scope.ScreenScaffold;

__ds_ns.TopAppBar = __ds_scope.TopAppBar;

})();
