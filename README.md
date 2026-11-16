# hylingo

Türkçe kelime bilme oyunu (Lingo tarzı) — Next.js + Docker.

- **Serbest mod:** İlk harf hazır, 5 tahmin, elenme yok.
- **Yarışma modu:** Her tahmin için 10 sn, 5 hak; bilemezsen ya da anlamsız kelime yazarsan elenirsin. Her 10. soru TDK'dan gelen bir kelime anlamı (20 sn, ilk harf açık, 3 sn'de bir rastgele harf açılır).
- Kelimeler 4–7 harfli.

## Çalıştırma

```bash
docker compose up -d --build      # http://localhost:3000
HOST_PORT=3100 docker compose up -d   # farklı port
```

Geliştirme: `npm install && npm run dev`

## Kelime listesi

`node scripts/build-words.mjs` → `lib/words.ts` üretir. Kaynaklar (`scripts/data/`):

- [StarlangSoftware/Dictionary-Py](https://github.com/StarlangSoftware/Dictionary-Py) sözlüğü (GPL-3.0)
- [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords) sıklık listesi
- [tdd-ai/hunspell-tr](https://github.com/tdd-ai/hunspell-tr) kelime gövdeleri
- Kelime anlamları çalışma anında TDK Güncel Türkçe Sözlük API'sinden alınır.

Sözlük verisi GPL-3.0 olduğundan proje de GPL-3.0 uyumlu dağıtılmalıdır.
