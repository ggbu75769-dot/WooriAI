const WORD_JOINER = "\u2060";

function isHangul(character: string) {
  const codePoint = character.codePointAt(0) ?? 0;
  return (
    (codePoint >= 0x1100 && codePoint <= 0x11ff) ||
    (codePoint >= 0x3130 && codePoint <= 0x318f) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7af)
  );
}

/**
 * Android may break Korean copy between any two syllables. Word Joiner has zero
 * visual width but keeps adjacent Hangul syllables together, while ordinary
 * spaces and explicit newlines remain valid wrap points.
 */
export function protectKoreanWordBoundaries(value: string) {
  const characters = Array.from(value);
  return characters
    .map((character, index) => {
      const next = characters[index + 1];
      return next && isHangul(character) && isHangul(next)
        ? `${character}${WORD_JOINER}`
        : character;
    })
    .join("");
}
