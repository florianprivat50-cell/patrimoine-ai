import type { FieldEvidence } from '../../../src/lib/evidence';
const text = (v: unknown): string => typeof v === 'string' ? v.replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim() : '';
export function numeric(v: unknown): number | undefined {
  if (typeof v === 'object' && v) v = (v as any).value;
  if (typeof v === 'string') v = Number(v.replace(/[\s\u00a0\u202f€]/g, '').replace(',', '.'));
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined;
}
export function extractListing(html: string, url: string) {
  const at = new Date().toISOString();
  const candidates: Record<string, Array<{ value: string | number; source: string }>> = {};
  const add = (field: string, value: unknown, source: string) => {
    const v = ['price','surface','monthlyRent','propertyTaxYearly','yearlyCharges','residentialLots'].includes(field) ? numeric(value) : text(value);
    if (v == null || v === '') return;
    if (field === 'postalCode' && !/^\d{5}$/.test(String(v))) return;
    if (field === 'dpe' && !/^[A-G]$/i.test(String(v))) return;
    (candidates[field] ??= []).push({ value: field === 'dpe' ? String(v).toUpperCase() : v, source });
  };
  const parseNode = (node: any, source: string) => {
    if (!node || typeof node !== 'object') return;
    // Only extract a property entity: never traverse recommendations, breadcrumbs or organisation prices.
    const kind = String(node['@type'] ?? '');
    if (!/Apartment|House|Residence|RealEstateListing|Product|Accommodation/i.test(kind) && !(node.price && (node.surface || node.livingArea || node.floorSize) && (node.address || node.city))) return;
    const n = node.mainEntity ?? node;
    add('title', n.name ?? n.title ?? node.name, source);
    add('description', n.description ?? node.description, source);
    const offer = Array.isArray(n.offers) ? n.offers.length === 1 ? n.offers[0] : {} : n.offers;
    if (!offer?.priceCurrency || offer.priceCurrency === 'EUR') add('price', offer?.price ?? n.price, source);
    add('surface', n.floorSize ?? n.surface ?? n.livingArea, source);
    const address = n.address ?? node.address ?? {};
    add('city', address.addressLocality ?? n.city, source); add('postalCode', address.postalCode ?? n.postalCode, source);
    add('street', address.streetAddress, source);
    add('dpe', n.energyClass ?? n.energyRating ?? n.dpe, source);
    for (const key of ['monthlyRent','propertyTaxYearly','yearlyCharges','residentialLots']) add(key, n[key], source);
  };
  for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/application\/ld\+json|application\/json|__NEXT_DATA__/i.test(match[1])) continue;
    try {
      const root = JSON.parse(match[2]);
      const source = /ld\+json/.test(match[1]) ? 'JSON-LD de l’annonce' : 'État applicatif de l’annonce';
      const nodes = Array.isArray(root) ? root : root['@graph'] ?? [root];
      for (const n of nodes) parseNode(n, source);
      // Explicit primary listing paths only, no recursive first-match extraction.
      for (const n of [root.props?.pageProps?.listing, root.props?.pageProps?.property, root.listing]) parseNode(n, source);
    } catch { /* Malformed structured data falls back to metadata/text. */ }
  }
  const metas: Record<string,string> = {};
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs: Record<string,string> = {};
    for (const a of tag[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)) attrs[a[1].toLowerCase()] = a[3];
    const key = attrs.property ?? attrs.name; if (key && attrs.content) metas[key] = attrs.content;
  }
  add('title', metas['og:title'], 'Métadonnées de l’annonce');
  add('price', metas['product:price:amount'], 'Métadonnées de l’annonce');
  const description = text(metas['og:description'] ?? metas.description);
  add('description', description, 'Métadonnées de l’annonce');
  // Prefer the listing description; exclude sidebars when a main/article is available.
  const main = html.match(/<(?:main|article)\b[^>]*>([\s\S]*?)<\/(?:main|article)>/i)?.[1] ?? '';
  const visible = text(main.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' '));
  const searchable = description || visible;
  const patterns: Record<string, RegExp> = {
    price: /(?:prix(?: de vente)?)\s*[:\-]?\s*([\d\s\u202f\u00a0]+)\s*€/i,
    surface: /(?:surface(?: habitable)?)\s*[:\-]?\s*(\d+(?:[,.]\d+)?)\s*m[²2]/i,
    monthlyRent: /(?:loyers? mensuels?)\s*[:\-]?\s*([\d\s]+)\s*€/i,
    propertyTaxYearly: /taxe fonci[eè]re\s*[:\-]?\s*([\d\s]+)\s*€/i,
    yearlyCharges: /charges annuelles\s*[:\-]?\s*([\d\s]+)\s*€/i,
    dpe: /(?:DPE|classe [ée]nergie)\s*[:\-]?\s*([A-G])\b/i,
  };
  for (const [key, re] of Object.entries(patterns)) add(key, searchable.match(re)?.[1], 'Texte de l’annonce');
  const fields: FieldEvidence[] = [];
  const values: Record<string, any> = {};
  for (const [field, list] of Object.entries(candidates)) {
    const distinct = [...new Set(list.map(x => x.value))];
    const conflict = distinct.length > 1 && !['title','description'].includes(field);
    // Conflicting critical facts are not silently chosen.
    if (!conflict) values[field] = list[0].value;
    fields.push({ field, value: list[0].value, source: [...new Set(list.map(x=>x.source))].join(' + '), url, retrievedAt: at, confidence: conflict ? 'low' : 'medium', status: conflict ? 'conflict' : 'declared', alternatives: conflict ? distinct : undefined });
  }
  values.address = [values.street, values.postalCode, values.city].filter(Boolean).join(', ');
  return { values, fields };
}
