import { NextRequest, NextResponse } from "next/server";

// TDK Güncel Türkçe Sözlük'ten kelimenin anlamını getirir (sunucu tarafında, CORS yok).
export async function GET(req: NextRequest) {
  const k = (req.nextUrl.searchParams.get("k") ?? "").trim().toLocaleLowerCase("tr-TR");
  if (!/^[a-zçğıöşü]{2,12}$/.test(k)) return NextResponse.json({ anlam: null }, { status: 400 });
  try {
    const r = await fetch(`https://sozluk.gov.tr/gts?ara=${encodeURIComponent(k)}`, {
      next: { revalidate: 60 * 60 * 24 * 30 },
      signal: AbortSignal.timeout(5000),
    });
    const data = await r.json();
    const first = Array.isArray(data) ? data[0] : null;
    const list: { anlam?: string }[] = first?.anlamlarListe ?? [];
    const anlam: string | null =
      list.map((a) => a.anlam ?? "").find((a) => a && !/^bkz\b/i.test(a)) ?? null;
    return NextResponse.json({ anlam });
  } catch {
    return NextResponse.json({ anlam: null });
  }
}
