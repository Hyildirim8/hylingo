// Aday kelimeleri TDK Güncel Türkçe Sözlük API'siyle doğrular ve anlamlarını kaydeder.
// Kullanım: node scripts/fetch-tdk.mjs   (yarıda kalırsa kaldığı yerden devam eder)
// Çıktı: scripts/data/tdk-cache.json  { kelime: "ilk anlam" | null }
import { existsSync, readFileSync, writeFileSync } from "node:fs";
const dir = new URL("./data/", import.meta.url);
const cands = readFileSync(new URL("candidates.txt", dir), "utf8").split("\n").filter(Boolean);
const cacheUrl = new URL("tdk-cache.json", dir);
const cache = existsSync(cacheUrl) ? JSON.parse(readFileSync(cacheUrl, "utf8")) : {};
const todo = cands.filter((w) => !(w in cache));
const CONC = 96;
const lower = (s) => s.replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase();
console.log(`toplam ${cands.length}, kalan ${todo.length}`);

async function look(w) {
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(`https://sozluk.gov.tr/gts?ara=${encodeURIComponent(w)}`, { signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      if (!Array.isArray(d)) return null;
      const e = d.find((x) => lower(x.madde ?? "") === w && x.ozel_mi !== "1");
      if (!e) return null;
      const m = (e.anlamlarListe ?? []).map((a) => a.anlam ?? "").find((a) => a && !/^bkz\b/i.test(a));
      return m ? m.slice(0, 200) : "";
    } catch { await new Promise((r) => setTimeout(r, 500 * (t + 1))); }
  }
  return undefined; // ulaşılamadı, önbelleğe yazma
}

let i = 0, done = 0;
const save = () => writeFileSync(cacheUrl, JSON.stringify(cache));
async function worker() {
  while (i < todo.length) {
    const w = todo[i++];
    const v = await look(w);
    if (v !== undefined) cache[w] = v;
    if (++done % 2000 === 0) { save(); console.log(done, "/", todo.length); }
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
save();
console.log("bitti", Object.values(cache).filter((v) => v !== null).length, "doğrulandı");
