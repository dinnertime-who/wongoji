import { safeGetItem, savePreference } from "#/shared/lib/storage";

/**
 * 마지막으로 연 원고.
 *
 * **이것만은 계정이 아니라 이 브라우저의 것이다.** 어느 원고를 보고 있었는지는
 * 기기마다 다르고, 다른 기기에서 열어 둔 원고가 여기서 열릴 이유가 없다.
 *
 * 계정별로 가르지 않는다. 계정을 바꾸면 이 id가 새 보관함에 없을 뿐이고, 그때는
 * 가장 최근에 고친 원고로 간다 — 스스로 바로잡히므로 칸을 나눌 값이 없다.
 *
 * 못 적어도 알리지 않는다. 다음에 열 때 다른 원고가 열린다는 뜻일 뿐이다.
 */
const KEY = "wongoji:v1:last";

export const readLastOpened = (): string | null => safeGetItem(KEY);
export const writeLastOpened = (id: string): void => savePreference(KEY, id);
