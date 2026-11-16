// Kelime listesi üretici: node scripts/build-words.mjs  ->  lib/words.ts
//  - scripts/data/turkish_dictionary.txt : StarlangSoftware/Dictionary-Py (TDK tabanlı sözlük, sözcük türü etiketli)
//  - scripts/data/freq-tr.txt            : hermitdave/FrequencyWords (sıklık sırası)
//  - scripts/words.txt                   : elle seçilmiş yaygın kelimeler (her zaman cevap olabilir)
// ANSWERS: günlük hayatta sık geçen isim/sıfat/zarflar (cevap olarak seçilir)
// VALID  : sözlükteki tüm isim/sıfat/zarflar (tahmin olarak kabul edilir)
import { readFileSync, writeFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const lower = (w) => w.replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase();
const OK = /^[a-zçğıöşü]+$/;
const BAD_FLAGS = new Set(["IS_OA", "IS_KIS", "IS_UU", "IS_HEADER", "IS_UD", "IS_CA"]);
const GOOD_FLAGS = ["CL_ISIM", "IS_ADJ", "IS_ADVERB"];
const BLOCK = new Set(["zenci", "siktir", "sikik", "amcık", "yarak", "orospu", "piç", "göt", "bok", "kahpe", "pezevenk", "ibne", "gavur", "çingene", "şahsi", "alman", "maço", "bebe", "zenci"]);
const FREQ_LIMIT = 30000;

const freq = new Map();
read("./data/freq-tr.txt").split("\n").forEach((w, i) => { w = lower(w.trim()); if (w && !freq.has(w)) freq.set(w, i); });

const dict = new Set();
for (const line of read("./data/turkish_dictionary.txt").split("\n")) {
  const [w, ...flags] = line.trim().split(/\s+/);
  if (!w || !OK.test(w) || flags.some((f) => BAD_FLAGS.has(f))) continue;
  if (flags.some((f) => GOOD_FLAGS.includes(f))) dict.add(w);
}
// TDK API ile doğrulanmış kelimeler (scripts/fetch-tdk.mjs; yarım kalmış olabilir)
let tdk = new Set();
try {
  const c = JSON.parse(read("./data/tdk-cache.json"));
  tdk = new Set(Object.keys(c).filter((w) => c[w] !== null));
} catch {}
// Metinlerde sık geçen (hunspell) gövdeler: sadece geçerli tahmin olarak
const common = read("./data/candidates.txt").split("\n").filter((w) => OK.test(w) && (freq.get(w) ?? 1e9) < FREQ_LIMIT);
const curated = new Set(read("./words.txt").split(/\s+/).map(lower).filter((w) => OK.test(w)));

const inRange = (w) => [...w].length >= 4 && [...w].length <= 7 && !BLOCK.has(w);
const answers = new Set([...curated, ...[...dict, ...tdk].filter((w) => (freq.get(w) ?? 1e9) < FREQ_LIMIT)].filter(inRange));
const valid = new Set([...answers, ...dict, ...tdk, ...common, ...curated].filter(inRange));
const cmp = (a, b) => a.localeCompare(b, "tr");
const by = (set, n) => [...set].filter((w) => [...w].length === n).sort(cmp);

const A = {}, V = {};
for (let n = 4; n <= 7; n++) {
  A[n] = by(answers, n);
  // geçerli tahminlerde cevaplar tekrar edilmez
  V[n] = by(valid, n).filter((w) => !answers.has(w));
}
writeFileSync(new URL("../lib/words.ts", import.meta.url),
`// Otomatik üretildi: node scripts/build-words.mjs
export const ANSWERS: Record<number, string[]> = ${JSON.stringify(A)};
export const EXTRA_VALID: Record<number, string[]> = ${JSON.stringify(V)};
`);
for (let n = 4; n <= 7; n++) console.log(n, "cevap:", A[n].length, "ek geçerli:", V[n].length);
