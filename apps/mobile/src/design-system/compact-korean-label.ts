/**
 * Compact cards have room for roughly six Korean syllables per line. Long labels
 * are balanced at an existing word boundary so Android never has to split a word.
 */
export function balanceCompactKoreanLabel(label: string, maxSyllablesPerLine = 6) {
  const words = label.trim().split(/\s+/).filter(Boolean);
  const syllableCount = words.reduce((total, word) => total + Array.from(word).length, 0);
  if (words.length < 2 || syllableCount <= maxSyllablesPerLine) return label;

  let bestIndex = 1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let index = 1; index < words.length; index += 1) {
    const left = words.slice(0, index).join(" ");
    const right = words.slice(index).join(" ");
    const leftLength = Array.from(left).length;
    const rightLength = Array.from(right).length;
    const overflow = Math.max(0, leftLength - maxSyllablesPerLine) + Math.max(0, rightLength - maxSyllablesPerLine);
    const score = overflow * 100 + Math.abs(leftLength - rightLength);
    if (score < bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  }

  return `${words.slice(0, bestIndex).join(" ")}\n${words.slice(bestIndex).join(" ")}`;
}
