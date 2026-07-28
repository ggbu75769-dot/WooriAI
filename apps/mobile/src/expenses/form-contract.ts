import { isFutureSeoulDate } from "@wooriai/domain";

export function sanitizeExpenseAmountText(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

export function formatExpenseAmountInput(digits: string): string {
  return digits ? Number(digits).toLocaleString("ko-KR") : "";
}

export function formatExpenseDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return { iso: `${year}-${month}-${day}`, label: `${year}. ${month}. ${day} (${weekday})` };
}

function isValidCalendarDate(dateOnly: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function validateExpenseDateInput(dateOnly: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return "YYYY-MM-DD 형식으로 입력해 주세요.";
  if (!isValidCalendarDate(dateOnly)) return "존재하지 않는 날짜예요.";
  try {
    if (isFutureSeoulDate(dateOnly)) return "미래 날짜는 선택할 수 없어요.";
  } catch {
    return "날짜를 다시 확인해 주세요.";
  }
  return null;
}

export function buildRecentExpenseDateChips(today: Date) {
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - index);
    const formatted = formatExpenseDate(date);
    const shortLabel = index === 0 ? "오늘" : index === 1 ? "어제" : index === 2 ? "그제" : `${date.getMonth() + 1}/${date.getDate()}`;
    return { iso: formatted.iso, shortLabel };
  });
}

export function validateExpenseForm(input: { itemName: string; amountText: string; spentOn: string }) {
  const amountKrw = Number(input.amountText || "0");
  const itemNameError = input.itemName.trim() ? null : "품목을 입력해 주세요.";
  const amountError = Number.isSafeInteger(amountKrw) && amountKrw > 0 ? null : "0보다 큰 금액을 입력해 주세요.";
  const dateError = validateExpenseDateInput(input.spentOn);
  return {
    amountKrw,
    itemNameError,
    amountError,
    dateError,
    valid: !itemNameError && !amountError && !dateError
  };
}
