"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BONUS_EVERY, BONUS_SECONDS, GUESS_SECONDS, LENGTHS, MAX_TRIES, REVEAL_MS, Status,
  bonusScore, evaluate, isValid, maskMeaning, normalScore, pickWord, randomLen, trLower,
} from "@/lib/game";

const KEY_ROWS = ["ertyuıopğü", "asdfghjklşi", "zcvbnmöç"];
const LETTERS = KEY_ROWS.join("");
const RANK: Record<Status, number> = { absent: 0, present: 1, correct: 2 };
type Stats = { runs: number; best: number; bestRound: number };
const EMPTY: Stats = { runs: 0, best: 0, bestRound: 0 };
type Phase = "loading" | "play" | "between" | "out" | "error";
type GameMode = "menu" | "free" | "comp";
type Kind = "normal" | "bonus";
const up = (s: string) => trLower(s).toLocaleUpperCase("tr-TR");

async function fetchMeaning(word: string): Promise<string | null> {
  try {
    const r = await fetch(`/api/anlam?k=${encodeURIComponent(word)}`);
    return (await r.json()).anlam ?? null;
  } catch {
    return null;
  }
}

export default function Game() {
  const [game, setGame] = useState<GameMode>("menu");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState(0); // 0 = karışık, 4-7 = sabit uzunluk
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [gained, setGained] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [kind, setKind] = useState<Kind>("normal");
  const [answer, setAnswer] = useState<string[]>([]);
  const [meaning, setMeaning] = useState<string | null>(null);
  const [won, setWon] = useState(false);
  // normal tur
  const [guesses, setGuesses] = useState<string[][]>([]);
  const [results, setResults] = useState<Status[][]>([]);
  const [current, setCurrent] = useState<string[]>([]);
  // bonus tur
  const [typed, setTyped] = useState<string[]>([]);
  const [order, setOrder] = useState<number[]>([]); // harflerin açılış sırası (ilk harf hep ilk)
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const [msg, setMsg] = useState("");
  const [shake, setShake] = useState(false);
  const [stats, setStats] = useState<Stats>(EMPTY);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const token = useRef(0);
  const len = answer.length;

  const flash = (t: string) => {
    setMsg(t);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(""), 1800);
  };
  const doShake = () => { setShake(true); setTimeout(() => setShake(false), 400); };

  const saveBest = useCallback((sc: number, rd: number, endRun: boolean) => {
    setStats((s) => {
      const n = {
        runs: s.runs + (endRun ? 1 : 0),
        best: Math.max(s.best, sc),
        bestRound: Math.max(s.bestRound, rd),
      };
      try { localStorage.setItem("hylingo-stats", JSON.stringify(n)); } catch {}
      return n;
    });
  }, []);

  const startRound = useCallback(async (r: number, m: number, g: "free" | "comp") => {
    const t = ++token.current;
    setRound(r); setPhase("loading"); setMeaning(null); setMsg(""); setWon(false); setReason("");
    setGuesses([]); setResults([]); setTyped([]); setElapsed(0);

    if (g === "comp" && r % BONUS_EVERY === 0) {
      // Yarışma: her 5. soru metin (TDK anlamı), cevap harf harf açılır
      for (let i = 0; i < 10; i++) {
        const w = pickWord(m || randomLen());
        const mean = await fetchMeaning(w);
        if (t !== token.current) return;
        if (mean) {
          const rest = Array.from({ length: w.length - 1 }, (_, k) => k + 1);
          for (let k = rest.length - 1; k > 0; k--) {
            const j = Math.floor(Math.random() * (k + 1));
            [rest[k], rest[j]] = [rest[j], rest[k]];
          }
          setOrder([0, ...rest]);
          setKind("bonus"); setAnswer([...w]); setMeaning(mean);
          setStartedAt(Date.now()); setPhase("play");
          return;
        }
      }
      // anlam bulunamazsa bu tur normal soru olarak devam eder
    }
    const w = [...pickWord(m || randomLen())];
    setKind("normal"); setAnswer(w); setCurrent([w[0]]);
    setStartedAt(Date.now()); setPhase("play");
  }, []);

  const startRun = useCallback((m: number, g: "free" | "comp") => {
    setScore(0); setGained(0);
    startRound(1, m, g);
  }, [startRound]);

  const begin = (g: "free" | "comp") => { setGame(g); startRun(mode, g); };
  const toMenu = () => { token.current++; setGame("menu"); setPhase("loading"); };

  useEffect(() => {
    let m = 0;
    try {
      const s = localStorage.getItem("hylingo-stats");
      if (s) setStats(JSON.parse(s));
      const saved = Number(localStorage.getItem("hylingo-mode"));
      if (saved === 0 || LENGTHS.includes(saved as 4)) m = saved;
    } catch {}
    setMode(m);
  }, []);

  // normal turda bitince anlamı getir
  useEffect(() => {
    if (kind !== "normal" || phase === "play" || phase === "loading" || answer.length === 0 || meaning) return;
    let live = true;
    fetchMeaning(answer.join("")).then((m) => live && setMeaning(m));
    return () => { live = false; };
  }, [kind, phase, answer, meaning]);

  // bonus sayacı
  useEffect(() => {
    if (phase !== "play" || (kind !== "bonus" && game !== "comp")) return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(id);
  }, [kind, phase, startedAt, game]);

  useEffect(() => {
    if (kind === "bonus" && phase === "play" && elapsed >= BONUS_SECONDS * 1000) {
      setGained(0); setWon(false); setPhase("between");
      saveBest(score, round, false);
    }
  }, [elapsed, kind, phase, score, round, saveBest]);

  // yarışmada normal tur: 10 sn içinde tahmin girilmezse hak yanar
  useEffect(() => {
    if (game !== "comp" || kind !== "normal" || phase !== "play" || elapsed < GUESS_SECONDS * 1000) return;
    const g = [...guesses, current.concat(Array(len).fill("")).slice(0, len)];
    setGuesses(g);
    setResults([...results, Array(len).fill("absent") as Status[]]);
    if (g.length >= MAX_TRIES) {
      setReason("Süre doldu, tahmin hakkın bitti");
      setGained(0); setPhase("out"); saveBest(score, round, true);
    } else {
      setCurrent([answer[0]]); setStartedAt(Date.now()); setElapsed(0);
      flash("Süre doldu, hak yandı!");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, game, kind, phase]);

  // ilk harf baştan açık, kalanlar rastgele sırayla 3 sn'de bir açılır; en az bir harf hep kapalı kalır
  const revealed = kind === "bonus" ? Math.min(1 + Math.floor(elapsed / REVEAL_MS), Math.max(len - 1, 1)) : 0;
  const openSet = new Set(order.slice(0, revealed));
  const secLeft = Math.max(0, Math.ceil(BONUS_SECONDS - elapsed / 1000));

  const next = useCallback(() => {
    if (game === "menu") return;
    if (phase === "out") startRun(mode, game);
    else if (phase === "between") startRound(round + 1, mode, game);
    else if (phase === "error") startRound(round, mode, game);
  }, [phase, game, mode, round, startRun, startRound]);

  const submit = useCallback(() => {
    if (phase !== "play") return;
    if (kind === "bonus") {
      if (typed.length < len) return flash("Eksik harf var");
      if (typed.join("") === answer.join("")) {
        const pts = bonusScore(secLeft, revealed, len);
        setGained(pts); setScore(score + pts); setWon(true); setPhase("between");
        saveBest(score + pts, round, false);
      } else if (isValid(typed.join(""), len)) {
        doShake(); setTyped([]); flash("Yanlış, tekrar dene!");
      } else {
        // anlamsız kelime -> elenir
        setReason(`“${up(typed.join(""))}” anlamlı bir kelime değil`);
        setGained(0); setPhase("out");
        saveBest(score, round, true);
      }
      return;
    }
    if (current.length < len) return flash("Eksik harf var");
    if (!isValid(current.join(""), len)) {
      if (game === "comp") {
        setReason(`“${up(current.join(""))}” anlamlı bir kelime değil`);
        setGained(0); setPhase("out"); saveBest(score, round, true);
        return;
      }
      doShake(); return flash("Kelime listemizde yok");
    }
    const res = evaluate(current, answer);
    const g = [...guesses, current];
    setGuesses(g); setResults([...results, res]);
    if (res.every((r) => r === "correct")) {
      const pts = normalScore(g.length, len);
      setGained(pts); setScore(score + pts); setWon(true); setPhase("between");
      if (game === "comp") saveBest(score + pts, round, false);
    } else if (g.length >= MAX_TRIES) {
      setGained(0);
      if (game === "comp") {
        setReason("5 tahmin hakkın bitti");
        setPhase("out"); saveBest(score, round, true);
      } else setPhase("between"); // serbest modda elenme yok
    } else {
      setCurrent([answer[0]]);
      if (game === "comp") { setStartedAt(Date.now()); setElapsed(0); }
    }
  }, [phase, kind, game, typed, len, answer, secLeft, revealed, score, round, current, guesses, results, saveBest]);

  const press = useCallback((k: string) => {
    if (phase === "between" || phase === "out" || phase === "error") return k === "ENTER" ? next() : undefined;
    if (phase !== "play") return;
    if (k === "ENTER") return submit();
    if (kind === "bonus") {
      if (k === "DEL") return setTyped((c) => c.slice(0, -1));
      return setTyped((c) => (c.length < len ? [...c, k] : c));
    }
    if (k === "DEL") return setCurrent((c) => (c.length > 1 ? c.slice(0, -1) : c));
    setCurrent((c) => (c.length < len ? [...c, k] : c));
  }, [phase, kind, len, submit, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Enter") { e.preventDefault(); return press("ENTER"); }
      if (e.key === "Backspace") return press("DEL");
      if (e.key.length === 1) {
        const k = trLower(e.key);
        if (LETTERS.includes(k)) press(k);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  const changeMode = (m: number) => {
    setMode(m);
    try { localStorage.setItem("hylingo-mode", String(m)); } catch {}
    if (game !== "menu") startRun(m, game);
  };

  const keyState: Record<string, Status> = {};
  guesses.forEach((g, r) => g.forEach((c, i) => {
    if (!c) return;
    const s = results[r][i];
    if (!keyState[c] || RANK[s] > RANK[keyState[c]]) keyState[c] = s;
  }));

  const isBonus = kind === "bonus";
  const ended = phase === "between" || phase === "out";
  const comp = game === "comp";
  const rows = Array.from({ length: MAX_TRIES }, (_, r) => {
    if (r < guesses.length) return { letters: guesses[r], res: results[r], active: false };
    if (r === guesses.length && phase === "play") return { letters: current, res: null, active: true };
    return { letters: [] as string[], res: null, active: false };
  });
  const tileStyle = { ["--n" as string]: len || 5 };

  if (game === "menu") {
    return (
      <main className="wrap menuPage">
        <h1 className="big">hy<span>lingo</span></h1>
        <p className="tag">Türkçe kelime bilme oyunu. Modunu seç:</p>
        <button className="mode" onClick={() => begin("free")}>
          <b>🎯 Serbest</b>
          <span>Klasik Lingo: ilk harf hazır, 5 denemede kelimeyi bul. Elenme yok, istediğin kadar oyna.</span>
        </button>
        <button className="mode comp" onClick={() => begin("comp")}>
          <b>🏆 Yarışma</b>
          <span>Klasik Lingo: 5 tahmin hakkı, her tahmin için 10 saniye. Her 10. soru bir kelime anlamı (20 sn, ilk harf açık, 3 sn'de bir rastgele harf açılır). Bilemezsen ya da anlamsız kelime yazarsan elenirsin. Rekor: {stats.best} puan</span>
        </button>
      </main>
    );
  }

  return (
    <main className="wrap">
      <header>
        <h1>hy<span>lingo</span></h1>
        <div className="hud">
          <span>Tur <b>{round}</b></span>
          <span>Puan <b>{score}</b></span>
          {comp && <span>Rekor <b>{stats.best}</b></span>}
          <button className="menu" onClick={toMenu}>Menü</button>
        </div>
      </header>

      <div className="lens">
        {[0, ...LENGTHS].map((n) => (
          <button key={n} className={n === mode ? "on" : ""} onClick={() => changeMode(n)}>
            {n === 0 ? "Karışık" : `${n} harf`}
          </button>
        ))}
      </div>

      <div className="msg" aria-live="polite">
        {msg || (phase === "loading" ? "Soru hazırlanıyor…" : isBonus && phase === "play" ? "Anlamdan kelimeyi bul!" : "")}
      </div>

      {phase === "play" && comp && !isBonus && (
        <div className="timer small">
          <div className="bar" style={{ width: `${Math.max(0, 100 - (elapsed / (GUESS_SECONDS * 1000)) * 100)}%` }} />
          <span>{Math.max(0, Math.ceil(GUESS_SECONDS - elapsed / 1000))} sn</span>
        </div>
      )}

      {phase !== "loading" && phase !== "error" && !isBonus && (
        <div className="board" style={tileStyle}>
          {rows.map((row, r) => (
            <div key={r} className={`row ${row.active && shake ? "shake" : ""}`}>
              {Array.from({ length: len }, (_, i) => {
                const ch = row.letters[i] ?? "";
                const st = row.res?.[i];
                const hint = row.active && i === 0;
                return (
                  <div key={i} className={`tile ${st ?? ""} ${hint ? "hint" : ""} ${ch && !st ? "filled" : ""}`}
                       style={st ? { animationDelay: `${i * 120}ms` } : undefined}>
                    {ch ? up(ch) : row.active ? "·" : ""}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {phase !== "loading" && phase !== "error" && isBonus && (
        <div className="bonus" style={tileStyle}>
          <div className="timer">
            <div className="bar" style={{ width: `${phase === "play" ? Math.max(0, 100 - (elapsed / (BONUS_SECONDS * 1000)) * 100) : 0}%` }} />
            <span>{phase === "play" ? secLeft : 0} sn</span>
          </div>
          <p className="clue">{meaning ? (phase === "play" ? maskMeaning(meaning, answer.join("")) : meaning) : ""}</p>
          <div className="row">
            {answer.map((c, i) => {
              const open = ended || openSet.has(i);
              return <div key={i} className={`tile ${open ? "correct" : ""}`}>{open ? up(c) : ""}</div>;
            })}
          </div>
          <div className={`row ${shake ? "shake" : ""}`}>
            {answer.map((_, i) => (
              <div key={i} className={`tile ${typed[i] ? "filled" : ""}`}>{typed[i] ? up(typed[i]) : ""}</div>
            ))}
          </div>
          <div className="sub">ilk harf açık · 3 sn'de bir rastgele harf açılır · anlamsız kelime girersen elenirsin</div>
        </div>
      )}

      {phase === "error" && (
        <div className="end bad">
          <div className="title">Soru yüklenemedi</div>
          <p className="meaning">Sözlük servisine ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.</p>
          <button className="primary" onClick={next}>Tekrar dene</button>
        </div>
      )}

      {ended && (
        <div className={`end ${phase === "out" ? "bad" : ""}`}>
          <div className="title">
            {phase === "out" ? "Elendin!" : won ? `Bildin! +${gained}` : isBonus ? "Süre doldu" : "Olmadı"}
          </div>
          <div className="word">Cevap: <b>{up(answer.join(""))}</b></div>
          {meaning && !isBonus && <p className="meaning">{meaning}</p>}
          {phase === "out" && reason && <p className="meaning">{reason}</p>}
          {phase === "out" && (
            <p className="meaning">{round}. turda elendin · Toplam <b>{score}</b> puan{score >= stats.best && score > 0 ? " · Yeni rekor! 🏆" : ""}</p>
          )}
          <button className="primary" onClick={next}>{phase === "out" ? "Yeniden başla" : "Sonraki tur"}</button>
        </div>
      )}

      <div className="kb">
        {KEY_ROWS.map((row, i) => (
          <div key={i} className="kbrow">
            {i === 2 && <button className="key wide" onClick={() => press("ENTER")}>GİR</button>}
            {[...row].map((k) => (
              <button key={k} className={`key ${keyState[k] ?? ""}`} onClick={() => press(k)}>{up(k)}</button>
            ))}
            {i === 2 && <button className="key wide" onClick={() => press("DEL")}>⌫</button>}
          </div>
        ))}
      </div>

      <footer>
        <span><i className="dot g" /> doğru yer</span>
        <span><i className="dot y" /> yanlış yer</span>
        <span>{comp ? `Yarışma: ${GUESS_SECONDS} sn/tahmin · elenme var` : "Serbest mod: elenme yok"}</span>
      </footer>
    </main>
  );
}
