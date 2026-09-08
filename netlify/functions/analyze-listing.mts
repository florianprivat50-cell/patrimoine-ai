import type { Config, Context } from "@netlify/functions";

const MAX_HTML = 2_000_000;
const TIMEOUT_MS = 10_000;

type Confidence = "high" | "medium" | "low";
type ExtractedField = { field: string; source: string; confidence: Confidence };

const cleanText = (v: unknown) =>
  typeof v === "string"
    ? v.replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim()
    : "";

const numberFrom = (v: unknown) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return undefined;
  const n = Number(v.replace(/[\u202f\u00a0\s]/g, "").replace(",", ".").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

function visibleText(html: string) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .slice(0, 160_000)
    .trim();
}

function collectJsonLd(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(re)) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) out.push(...parsed);
      else if (parsed?.["@graph"] && Array.isArray(parsed["@graph"])) out.push(...parsed["@graph"]);
      else out.push(parsed);
    } catch {}
  }
  return out;
}

function collectEmbeddedJson(html: string): any[] {
  const out: any[] = [];
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(re)) {
    const attrs = match[1] ?? "";
    const body = (match[2] ?? "").trim();
    if (!body || body.length > 800_000) continue;
    if (!/__NEXT_DATA__|application\/json|data-state|initial-state|apollo/i.test(attrs) && !/^[\[{]/.test(body)) continue;
    try { out.push(JSON.parse(body)); } catch {}
  }
  return out;
}

function meta(html: string, key: string) {
  const safe = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${safe}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${safe}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return cleanText(m[1]);
  }
  return undefined;
}

function walk(value: any, keys: string[], seen = new Set<any>(), depth = 0): any {
  if (!value || typeof value !== "object" || depth > 8 || seen.has(value)) return undefined;
  seen.add(value);
  const wanted = new Set(keys.map((k) => k.toLowerCase()));
  for (const [k, v] of Object.entries(value)) if (wanted.has(k.toLowerCase()) && v != null) return v;
  for (const child of Object.values(value)) {
    if (child && typeof child === "object") {
      const found = walk(child, keys, seen, depth + 1);
      if (found != null) return found;
    }
  }
  return undefined;
}

function structured(roots: any[], keys: string[]) {
  for (const root of roots) {
    const value = walk(root, keys);
    if (value != null) return value;
  }
  return undefined;
}

function matchNumber(text: string, patterns: RegExp[]) {
  for (const p of patterns) {
    const m = text.match(p);
    const n = m?.[1] ? numberFrom(m[1]) : undefined;
    if (n) return n;
  }
  return undefined;
}

function matchText(text: string, patterns: RegExp[]) {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return cleanText(m[1]);
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
        "user-agent": "PatrimoineIA/1.0 (+https://patrimoine-ai.app)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "fr-FR,fr;q=0.9",
      },
    });

    if (!response.ok) {
      return Response.json({
        ok: false,
        source: url.hostname,
        blocked: [401, 403, 429].includes(response.status),
        httpStatus: response.status,
        error: `Le portail ne fournit pas directement le contenu de cette annonce (${response.status}).`,
      });
    }

    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("application/xhtml+xml")) {
      return Response.json({ ok: false, source: url.hostname, error: "La ressource reçue n’est pas une page HTML exploitable." });
    }

    const html = (await response.text()).slice(0, MAX_HTML);
    const pageText = visibleText(html);
    const jsonLd = collectJsonLd(html);
    const embedded = collectEmbeddedJson(html);
    const roots = [...jsonLd, ...embedded];
    const searchable = `${meta(html, "og:title") ?? ""} ${meta(html, "og:description") ?? ""} ${pageText}`;

    const title = cleanText(structured(roots, ["name", "headline", "title"])) || meta(html, "og:title") || meta(html, "twitter:title");
    const description = cleanText(structured(roots, ["description", "body", "text"])) || meta(html, "og:description") || meta(html, "description");

    const structuredPrice = numberFrom(structured(roots, ["price", "amount", "priceValue", "salePrice"]));
    const price = structuredPrice || numberFrom(meta(html, "product:price:amount")) || matchNumber(searchable, [
      /(?:prix|price)\s*[:\-]?\s*([0-9\s\u00a0\u202f]{4,12})\s*€/i,
      /([0-9\s\u00a0\u202f]{4,12})\s*€(?:\s*(?:FAI|honoraires|H\.A\.I))?/i,
    ]);

    const rawSurface = structured(roots, ["floorSize", "surface", "surfaceArea", "livingArea", "area", "habitableSurface"]);
    const surface = numberFrom(rawSurface?.value ?? rawSurface) || matchNumber(searchable, [
      /(?:surface(?:\s+habitable)?|habitable)\s*[:\-]?\s*([0-9]{1,4}(?:[,.][0-9]+)?)\s*m[²2]/i,
      /([0-9]{1,4}(?:[,.][0-9]+)?)\s*m[²2]\b/i,
    ]);

    const postalCode = cleanText(structured(roots, ["postalCode", "zipCode", "zipcode"])) || matchText(searchable, [/\b([0-9]{5})\b/]);
    const city = cleanText(structured(roots, ["addressLocality", "city", "town", "locality"])) || matchText(searchable, [/(?:situ[ée]|localis[ée]|à vendre)\s+(?:à|sur)\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ' -]{2,40})/i]);
    const street = cleanText(structured(roots, ["streetAddress", "addressLine", "street"]));

    const dpeStructured = cleanText(structured(roots, ["energyClass", "energyRating", "dpe", "diagnosticPerformanceEnergetique"]));
    const dpe = dpeStructured.match(/[A-G]/i)?.[0]?.toUpperCase() || matchText(searchable, [/(?:DPE|classe\s+énergie|diagnostic\s+de\s+performance\s+énergétique)[^A-G]{0,25}\b([A-G])\b/i])?.toUpperCase();

    const monthlyRent = numberFrom(structured(roots, ["monthlyRent", "rent", "rentalIncome", "monthlyRentalIncome"])) || matchNumber(searchable, [
      /(?:loyers?\s+(?:mensuels?|actuels?)|revenus?\s+locatifs?)\s*[:\-]?\s*([0-9\s]{2,8})\s*€(?:\s*\/\s*mois)?/i,
      /(?:lou[ée]s?|loyer)\s+(?:pour|à)\s+([0-9\s]{2,8})\s*€\s*(?:\/\s*mois|mensuels?)/i,
    ]);

    const propertyTaxYearly = numberFrom(structured(roots, ["propertyTax", "propertyTaxYearly", "taxeFonciere"])) || matchNumber(searchable, [/(?:taxe\s+fonci[eè]re)\s*[:\-]?\s*([0-9\s]{2,8})\s*€/i]);
    const yearlyCharges = numberFrom(structured(roots, ["annualCharges", "yearlyCharges", "chargesYearly", "chargesAnnuelles"])) || matchNumber(searchable, [/(?:charges?\s+(?:annuelles?|de\s+copropri[eé]t[eé]))\s*[:\-]?\s*([0-9\s]{2,8})\s*€/i]);
    const rooms = numberFrom(structured(roots, ["numberOfRooms", "rooms", "roomCount", "nbRooms"])) || matchNumber(searchable, [/\b([1-9][0-9]?)\s*(?:pi[eè]ces?|p\.)\b/i]);
    const bedrooms = numberFrom(structured(roots, ["numberOfBedrooms", "bedrooms", "bedroomCount", "nbBedrooms"])) || matchNumber(searchable, [/\b([1-9][0-9]?)\s*chambres?\b/i]);
    const residentialLots = numberFrom(structured(roots, ["residentialLots", "housingUnits", "numberOfUnits", "nbLots"])) || matchNumber(searchable, [/\b([1-9][0-9]?)\s+(?:lots?|logements?|appartements?)\b/i]);

    const extracted: ExtractedField[] = [];
    const add = (field: string, value: unknown, highSource: boolean) => {
      if (value == null || value === "") return;
      extracted.push({ field, source: highSource ? "données structurées" : "texte / métadonnées", confidence: highSource ? "high" : "medium" });
    };
    add("title", title, !!structured(roots, ["name", "headline", "title"]));
    add("price", price, !!structuredPrice);
    add("surface", surface, !!rawSurface);
    add("city", city, !!structured(roots, ["addressLocality", "city", "town", "locality"]));
    add("postalCode", postalCode, !!structured(roots, ["postalCode", "zipCode", "zipcode"]));
    add("address", street, !!street);
    add("dpe", dpe, !!dpeStructured);
    add("monthlyRent", monthlyRent, !!structured(roots, ["monthlyRent", "rent", "rentalIncome", "monthlyRentalIncome"]));
    add("propertyTaxYearly", propertyTaxYearly, !!structured(roots, ["propertyTax", "propertyTaxYearly", "taxeFonciere"]));
    add("yearlyCharges", yearlyCharges, !!structured(roots, ["annualCharges", "yearlyCharges", "chargesYearly", "chargesAnnuelles"]));
    add("rooms", rooms, !!structured(roots, ["numberOfRooms", "rooms", "roomCount", "nbRooms"]));
    add("bedrooms", bedrooms, !!structured(roots, ["numberOfBedrooms", "bedrooms", "bedroomCount", "nbBedrooms"]));
    add("residentialLots", residentialLots, !!structured(roots, ["residentialLots", "housingUnits", "numberOfUnits", "nbLots"]));

    let lat: number | undefined;
    let lng: number | undefined;
    const warnings: string[] = [];
    const query = [street, postalCode, city].filter(Boolean).join(" ");
    if (query) {
      try {
        const geo = await fetch(`https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(query)}&limit=1`, { signal: controller.signal });
        if (geo.ok) {
          const gj: any = await geo.json();
          const coords = gj?.features?.[0]?.geometry?.coordinates;
          if (Array.isArray(coords) && coords.length >= 2) { lng = Number(coords[0]); lat = Number(coords[1]); }
        }
      } catch { warnings.push("Géocodage indisponible pendant cette analyse."); }
    }

    if (!price) warnings.push("Prix non détecté automatiquement.");
    if (!surface) warnings.push("Surface non détectée automatiquement.");
    if (!city) warnings.push("Ville non détectée automatiquement.");
    if (!monthlyRent) warnings.push("Loyers non détectés : ils devront être confirmés manuellement ou par comparables.");

    const highCount = extracted.filter((x) => x.confidence === "high").length;
    const confidence: Confidence = highCount >= 4 ? "high" : extracted.length >= 4 ? "medium" : "low";

    return Response.json({
      ok: extracted.length > 0,
      source: url.hostname,
      finalUrl: response.url,
      confidence,
      title,
      description,
      price,
      surface,
      city,
      postalCode,
      address: [street, postalCode, city].filter(Boolean).join(", ") || undefined,
      dpe,
      monthlyRent,
      propertyTaxYearly,
      yearlyCharges,
      rooms,
      bedrooms,
      residentialLots,
      lat,
      lng,
      extracted,
      warnings,
      diagnostics: {
        jsonLdBlocks: jsonLd.length,
        embeddedJsonBlocks: embedded.length,
        htmlBytesRead: html.length,
      },
    });
  } catch (error: any) {
    return Response.json({
      ok: false,
      source: url.hostname,
      error: error?.name === "AbortError" ? "Le portail n’a pas répondu dans le délai prévu." : "Impossible de lire automatiquement cette annonce.",
    });
  } finally {
    clearTimeout(timer);
  }
};

export const config: Config = { path: "/.netlify/functions/analyze-listing" };
