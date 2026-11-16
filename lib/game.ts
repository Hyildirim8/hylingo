import { ANSWERS, EXTRA_VALID } from "./words";

export type Status = "correct" | "present" | "absent";
export const MAX_TRIES = 5;
export const LENGTHS = [4, 5, 6, 7] as const;

export const trLower = (s: string) => s.toLocaleLowerCase("tr-TR");

export function pickWord(len: number): string {
  const list = ANSWERS[len];
  return list[Math.floor(Math.random() * list.length)];
}

export function isValid(word: string, len: number): boolean {
  return ANSWERS[len].includes(word) || EXTRA_VALID[len].includes(word);
}

export function evaluate(guess: string[], answer: string[]): Status[] {
  const res: Status[] = guess.map(() => "absent");
  const left = new Map<string, number>();
  answer.forEach((c, i) => {
    if (guess[i] === c) res[i] = "correct";
    else left.set(c, (left.get(c) ?? 0) + 1);
  });
  guess.forEach((c, i) => {
    if (res[i] === "correct") return;
    const n = left.get(c) ?? 0;
    if (n > 0) {
      res[i] = "present";
      left.set(c, n - 1);
    }
  });
  return res;
}

// ---- Yarışma modu ----
export const BONUS_EVERY = 10; // her 10. tur: anlamdan kelime bulma
export const BONUS_SECONDS = 20;
export const GUESS_SECONDS = 10; // yarışmada her tahmin için süre
export const REVEAL_MS = 3000; // 3 saniyede bir harf açılır

export const randomLen = () => LENGTHS[Math.floor(Math.random() * LENGTHS.length)];

/** Normal tur puanı: ne kadar az denemeyle bilirsen o kadar çok. */
export const normalScore = (triesUsed: number, len: number) =>
  100 + 25 * (MAX_TRIES - triesUsed) + 10 * len;

/** Bonus tur puanı: erken ve az harf açılmışken bilmek daha çok puan verir. */
export const bonusScore = (secondsLeft: number, revealed: number, len: number) =>
  150 + 15 * secondsLeft + 25 * (len - revealed);

/** Anlam metninde cevabın kendisi geçiyorsa gizler. */
export function maskMeaning(meaning: string, word: string) {
  return meaning.replace(new RegExp(word, "giu"), "_____");
}
