export type PixelOverrideMap = Record<string, Record<string, number>>;

export type TuneScreenConfig = {
  name: string;
  siblings: string[];
  moreSettingsGuardRequired: boolean;
};

export type TuneCandidate = {
  key: string;
  unit: "dp" | "ratio";
  valueSemantics: "absolute";
  baseline: number;
  baselineSource: "generated-override" | "style-fallback";
  deltas: number[];
  values: number[];
};

export type ExcludedTuneParameter = {
  key: string;
  reason: "zero-height-sentinel-has-no-declared-effective-baseline";
};

const pixelNumberPattern =
  /pixelNumber\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g;
const pixelDeltas = [-8, -6, -4, -2, 2, 4, 6, 8];
const ratioDeltas = [-0.08, -0.06, -0.04, -0.02, 0.02, 0.04, 0.06, 0.08];

function roundCandidate(value: number) {
  return Number(value.toFixed(4));
}

function candidateUnit(key: string): TuneCandidate["unit"] {
  return /scale(?:x|y)?$/i.test(key) ? "ratio" : "dp";
}

function allowsNegativeValue(key: string) {
  return /offset$/i.test(key);
}

export function readStyleFallbacks(screenId: string, styleSources: string[]) {
  const fallbacks: Record<string, number> = {};
  for (const source of styleSources) {
    for (const match of source.matchAll(pixelNumberPattern)) {
      if (match[1] !== screenId) continue;
      const key = match[2];
      const fallback = Number(match[3]);
      if (key in fallbacks && fallbacks[key] !== fallback) {
        throw new Error(`DUPLICATE_TUNE_FALLBACK ${screenId}.${key}`);
      }
      fallbacks[key] = fallback;
    }
  }
  return fallbacks;
}

export function buildTuneScaffold(
  screenId: string,
  screen: TuneScreenConfig,
  styleSources: string[],
  generatedOverrides: PixelOverrideMap
) {
  const fallbacks = readStyleFallbacks(screenId, styleSources);
  const excludedParameters: ExcludedTuneParameter[] = [];
  const candidates = Object.entries(fallbacks).flatMap(([key, fallback]): TuneCandidate[] => {
    const generatedValue = generatedOverrides[screenId]?.[key];
    const hasGeneratedValue = Number.isFinite(generatedValue);
    const baseline = hasGeneratedValue ? generatedValue : fallback;
    if (!hasGeneratedValue && baseline === 0 && /height$/i.test(key)) {
      excludedParameters.push({
        key,
        reason: "zero-height-sentinel-has-no-declared-effective-baseline"
      });
      return [];
    }
    const unit = candidateUnit(key);
    const deltas = unit === "ratio" ? ratioDeltas : pixelDeltas;
    const values = deltas
      .map((delta) => roundCandidate(baseline + delta))
      .filter((value) => value > 0 || (value < 0 && allowsNegativeValue(key)));

    return [{
      key,
      unit,
      valueSemantics: "absolute",
      baseline,
      baselineSource: hasGeneratedValue ? "generated-override" : "style-fallback",
      deltas,
      values
    }];
  });
  if (candidates.length === 0) throw new Error(`TUNE_STYLE_CONTRACT_MISSING ${screenId}`);

  const requiredChecks = [
    screenId,
    ...screen.siblings,
    ...(screen.moreSettingsGuardRequired ? ["SET-001"] : [])
  ].filter((id, index, ids) => ids.indexOf(id) === index);

  return {
    screenId,
    name: screen.name,
    strategy:
      "Each value is an absolute debug-only override, not a delta. Apply one value, then run the target and every required check. The full Android gate forbids temporary overrides.",
    requiredChecks,
    excludedParameters,
    candidates
  };
}
