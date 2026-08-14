import type { ReactElement } from "react";
import testRenderer, { act, type ReactTestRenderer, type TestRendererOptions } from "react-test-renderer";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export function render(element: ReactElement, options?: TestRendererOptions): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = testRenderer.create(element, options);
  });
  if (!tree) {
    throw new Error("TEST_RENDER_DID_NOT_COMMIT");
  }
  return tree;
}
