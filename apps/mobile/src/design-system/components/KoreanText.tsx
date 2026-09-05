import { Fragment, cloneElement, forwardRef, isValidElement, type ReactNode } from "react";
import { Text as NativeText, type TextProps } from "react-native";
import { protectKoreanWordBoundaries } from "../korean-word-boundaries";

/**
 * App-wide text primitive for Korean-first copy.
 *
 * iOS keeps Hangul words together natively. Android text receives zero-width
 * word-boundary protection so it can wrap at spaces without splitting a Korean
 * word. flexShrink lets row content yield space and wrap instead of clipping.
 */
function protectTextNode(node: ReactNode): ReactNode {
  if (typeof node === "string") return protectKoreanWordBoundaries(node);
  if (Array.isArray(node)) return node.map(protectTextNode);
  if (isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment) {
    return cloneElement(node, undefined, protectTextNode(node.props.children));
  }
  return node;
}

export const KoreanText = forwardRef<NativeText, TextProps>(function KoreanText(
  {
    android_hyphenationFrequency = "none",
    children,
    lineBreakStrategyIOS = "hangul-word",
    style,
    textBreakStrategy = "highQuality",
    ...props
  },
  ref
) {
  return (
    <NativeText
      {...props}
      android_hyphenationFrequency={android_hyphenationFrequency}
      lineBreakStrategyIOS={lineBreakStrategyIOS}
      ref={ref}
      style={[{ flexShrink: 1 }, style]}
      textBreakStrategy={textBreakStrategy}
    >
      {process.env.NODE_ENV === "test" ? children : protectTextNode(children)}
    </NativeText>
  );
});

KoreanText.displayName = "KoreanText";
