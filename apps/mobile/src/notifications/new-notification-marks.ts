/**
 * 라운드 40 J-7 — 알림함의 "새 소식" 점을 **누가 지우는가**.
 *
 * 이 화면은 포커스와 동시에 전부 읽음 처리하므로(markAllRead), 어떤 줄이 이번에 새로 온
 * 것인지는 읽음 처리 직전의 안읽음 스냅샷으로만 알 수 있다(라운드 39 UX-O). 라운드 39 I-7은
 * 그 스냅샷을 포커스마다 **교체**하도록 고쳤는데 — 알림을 눌러 나갔다 돌아오는 흔한 경로에서
 * 마운트 1회 스냅샷이 낡기 때문이다 — 교체이다 보니 새 문제가 생겼다.
 *
 * 3건이 새로 와서 점 3개를 보고, 그중 1건만 눌러 예산 화면에 갔다가 돌아오면: 돌아온 순간의
 * 안읽음은 0건이다(첫 포커스가 이미 전부 읽음 처리했다). 그래서 스냅샷이 빈 배열로 교체되고,
 * **아직 보지도 않은 나머지 2건의 점까지 함께 사라진다.** 사용자가 한 일은 한 건을 확인한
 * 것뿐인데 "새 소식"이라는 표시가 통째로 없어지는 것이다.
 *
 * 규칙을 교체에서 **합집합 − 사용자가 실제로 탭한 것**으로 바꾼다:
 *  - 직전 스냅샷 ∪ 이번 포커스 직전의 안읽음(= 화면을 떠 있는 동안 새로 도착한 항목);
 *  - 그중 사용자가 탭한 항목만 뺀다(탭 핸들러가 그 id를 지운다);
 *  - 목록에서 사라진 항목(모두 지우기·정리)도 뺀다 — 없는 줄의 표시를 들고 있을 이유가 없다.
 *
 * 읽음 규칙(readAt)과 스토어는 건드리지 않는다. 이 표시는 화면 상태일 뿐이고, 판정만 여기서
 * 순수 함수로 갖는다(화면은 vitest에서 렌더할 수 없다).
 */

/**
 * 이번 포커스의 "새 소식" id 목록.
 *
 * @param previous 직전 스냅샷(첫 포커스면 빈 배열).
 * @param unreadIds 읽음 처리 **직전의** 안읽음 id — 화면을 떠 있는 동안 새로 도착한 항목이다.
 * @param presentIds 지금 목록에 남아 있는 항목 id 전체. 여기에 없는 id는 떨군다.
 */
export function mergeNewNotificationMarks(
  previous: readonly string[],
  unreadIds: readonly string[],
  presentIds: readonly string[]
): string[] {
  const present = new Set(presentIds);
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const id of [...previous, ...unreadIds]) {
    if (seen.has(id)) continue;
    if (!present.has(id)) continue;
    seen.add(id);
    merged.push(id);
  }
  return merged;
}

/**
 * 사용자가 실제로 열어 본 항목의 표시를 지운다. 그 항목을 눌렀다는 것 하나만이 "봤다"는
 * 확실한 근거다 — 다른 줄의 표시는 그대로 남는다.
 */
export function removeNotificationMark(previous: string[], id: string): string[] {
  // 바뀌는 게 없으면 같은 배열을 돌려준다 — 표시와 무관한 리렌더를 만들지 않는다.
  if (!previous.includes(id)) return previous;
  return previous.filter((candidate) => candidate !== id);
}
