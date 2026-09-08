import type { Config, Context } from "@netlify/functions";

const MAX_HTML = 1_500_000;
const TIMEOUT_MS = 8000;

const text = (v: unknown) => typeof v === "string" ? v.trim() : "";
const numberFrom = (v: unknown) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return undefined;
  const n = Number(v.replace(/\s/g, "").replace(",", ".").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

function collectJsonLd(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(re)) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) out.push(...parsed);
      else if (parsed?.["@graph"] && Array.isArray(parsed["@graph"])) out.push(...parsed["@graph"]);
      else out.push(parsed);
    } catch { /* malformed publisher JSON-LD: ignore */ }
  }
  return out;
}

function meta(html: string, key: string) {
  const safe = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${safe}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${safe}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  }
  return undefined;
}

function walk(value: any, keys: string[]): any {
  if (!value || typeof value !== "object") return undefined;
  for (const k of keys) if (value[k] != null) return value[k];
  for (const child of Object.values(value)) {
    if (child && typeof child === "object") {
      const found = walk(child, keys);
      if (found != null) return found;
    }
  }
  return undefined;
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return Response.json({ ok: false, error: "Méthode non autorisée." }, { status: 405 });
  let url: URL;
  try {
    const body = await req.json();
    url = new URL(String(body?.url ?? ""));
    if (!/^https?:$/.test(url.protocol)) throw new Error();
  } catch {
    return Response.json({ ok: false, error: "Lien d’annonce invalide." }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; PatrimoineIA/1.0; +https://patrimoine-ai.app)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
      return Response.json({ ok: false, source: url.hostname, error: `Le site de l’annonce refuse l’accès automatique (${response.status}). Saisissez les données manuellement ou utilisez une source accessible.` });
    }
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("text/html")) return Response.json({ ok: false, source: url.hostname, error: "La ressource n’est pas une page HTML exploitable." });
    const raw = await response.text();
    const html = raw.slice(0, MAX_HTML);
    const nodes = collectJsonLd(html);
    const root = nodes.find((x) => /product|residence|apartment|house|offer/i.test(String(x?.["@type"] ?? ""))) ?? nodes[0] ?? {};
    const offers = root.offers ?? walk(root, ["offers", "offer"]) ?? {};
    const addressObj = root.address ?? walk(root, ["address"]) ?? {};
    const floorSize = root.floorSize ?? walk(root, ["floorSize"]) ?? {};

    const title = text(root.name) || meta(html, "og:title") || meta(html, "twitter:title");
    const description = text(root.description) || meta(html, "og:description") || meta(html, "description");
    const price = numberFrom(offers.price ?? root.price ?? walk(root, ["price"]));
    const surface = numberFrom(floorSize.value ?? walk(root, ["floorSize", "surface", "area"]));
    const city = text(addressObj.addressLocality ?? addressObj.city ?? walk(root, ["addressLocality"]));
    const postalCode = text(addressObj.postalCode ?? walk(root, ["postalCode"]));
    const street = text(addressObj.streetAddress ?? walk(root, ["streetAddress"]));
    const dpeRaw = `${title ?? ""} ${description ?? ""}`.match(/(?:DPE|classe\s+énergie|diagnostic[^A-G]{0,20})\s*[:\-]?\s*([A-G])\b/i)?.[1];

    const extracted: string[] = [];
    if (title) extracted.push("titre");
    if (price) extracted.push("prix");
    if (surface) extracted.push("surface");
    if (city) extracted.push("ville");
    if (postalCode) extracted.push("code postal");
    if (street) extracted.push("adresse");
    if (dpeRaw) extracted.push("DPE");

    let lat: number | undefined;
    let lng: number | undefined;
    const warnings: string[] = [];
    const query = [street, postalCode, city].filter(Boolean).join(" ");
    if (query) {
      try {
        const geo = await fetch(`https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(query)}&limit=1`);
        if (geo.ok) {
          const gj: any = await geo.json();
          const coords = gj?.features?.[0]?.geometry?.coordinates;
          if (Array.isArray(coords) && coords.length >= 2) { lng = Number(coords[0]); lat = Number(coords[1]); }
        }
      } catch { warnings.push("Géocodage non disponible pendant cette analyse."); }
    }

    if (!price) warnings.push("Prix non détecté automatiquement.");
    if (!surface) warnings.push("Surface non détectée automatiquement.");
    if (!city) warnings.push("Ville non détectée automatiquement.");
    const confidence = extracted.length >= 5 ? "high" : extracted.length >= 3 ? "medium" : "low";

    return Response.json({
      ok: extracted.length > 0,
      source: url.hostname,
      title,
      description,
      price,
      surface,
      city,
      postalCode,
      address: [street, postalCode, city].filter(Boolean).join(", ") || undefined,
      dpe: dpeRaw?.toUpperCase(),
      lat,
      lng,
      confidence,
      extracted,
      warnings,
    });
  } catch (error: any) {
    const timedOut = error?.name === "AbortError";
    return Response.json({ ok: false, source: url.hostname, error: timedOut ? "Le site de l’annonce n’a pas répondu assez vite." : "Impossible de lire automatiquement cette annonce. Saisissez les informations manuellement : aucune donnée ne sera inventée." });
  } finally {
    clearTimeout(timer);
  }
};

export const config: Config = { path: "/.netlify/functions/analyze-listing" };
