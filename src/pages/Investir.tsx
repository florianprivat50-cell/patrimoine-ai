import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { computeDeal, effectiveProjectInputs } from "../lib/deal";
import { computeFeasibilityScore } from "../lib/feasibility";
import { fmtEUR, fmtPct } from "../lib/finance";
import { compareToMarket } from "../lib/market";
import { useStore, uid } from "../store";
import { RealEstateProject } from "../types";

interface ListingResponse {
  ok: boolean;
  source?: string;
  title?: string;
  description?: string;
  price?: number;
  surface?: number;
  city?: string;
  postalCode?: string;
  address?: string;
  dpe?: string;
  lat?: number;
  lng?: number;
  confidence?: "high" | "medium" | "low";
  extracted?: string[];
  warnings?: string[];
  error?: string;
}

function initialProject(): RealEstateProject {
  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    name: "Nouvelle opportunité",
    city: "",
    postalCode: "",
    address: "",
    listingUrl: "",
    propertyType: "Immeuble",
    surface: 140,
    residentialLots: 3,
    commercialLots: 0,
    commercialMonthlyRent: 0,
    analysisMode: "approfondie",
    rentalMode: "classique",
    targetNetYieldPct: 7,
    price: 200000,
    agencyFees: 0,
    notaryFeesPct: 8,
    works: 20000,
    furniture: 0,
    bankFees: 1500,
    downPayment: 15000,
    ratePct: 3.5,
    durationYears: 25,
    insurancePctYearly: 0.3,
    monthlyRent: 1800,
    monthlyCharges: 180,
    propertyTaxYearly: 1800,
    ownerInsuranceYearly: 450,
    managementPct: 0,
    maintenancePct: 5,
    vacancyPct: 8,
    taxRatePct: 30,
    rentGrowthPct: 1,
    valueGrowthPct: 1,
  };
}

const tensionToScore = (tension: string | null | undefined) =>
  tension === "très forte" ? 92 : tension === "forte" ? 80 : tension === "modérée" ? 60 : tension === "faible" ? 38 : 50;

export default function Investir() {
  const { projects, addProject, updateProject } = useStore();
  const [p, setP] = useState<RealEstateProject>(initialProject);
  const [url, setUrl] = useState("");
  const [listing, setListing] = useState<ListingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const patch = (x: Partial<RealEstateProject>) => setP((prev) => ({ ...prev, ...x }));
  const effective = useMemo(() => effectiveProjectInputs(p), [p]);
  const deal = useMemo(() => computeDeal(effective), [effective]);
  const realistic = deal.results.realiste;
  const prudent = deal.results.prudent;
  const optimistic = deal.results.optimiste;
  const subjectPricePerSqm = p.surface && p.surface > 0 ? p.price / p.surface : undefined;
  const localMarket = useMemo(
    () => compareToMarket(p.city, p.postalCode, subjectPricePerSqm ?? null),
    [p.city, p.postalCode, subjectPricePerSqm]
  );

  const feasibility = useMemo(() => computeFeasibilityScore({
    askingPrice: p.price,
    totalCost: realistic.totalCost,
    subjectMonthlyRent: realistic.grossMonthlyRent,
    targetNetYieldPct: p.targetNetYieldPct,
    breakEvenRent: realistic.breakEvenRent,
    realistic: {
      monthlyCashflow: realistic.monthlyCashflow,
      monthlyDebtService: realistic.monthlyLoanPayment,
      yearlyNetOperatingIncome: realistic.yearlyNetIncome,
      netAfterTaxYieldPct: realistic.netAfterTaxYieldPct,
    },
    prudent: {
      monthlyCashflow: prudent.monthlyCashflow,
      monthlyDebtService: prudent.monthlyLoanPayment,
      yearlyNetOperatingIncome: prudent.yearlyNetIncome,
      netAfterTaxYieldPct: prudent.netAfterTaxYieldPct,
    },
    optimistic: {
      monthlyCashflow: optimistic.monthlyCashflow,
      monthlyDebtService: optimistic.monthlyLoanPayment,
      yearlyNetOperatingIncome: optimistic.yearlyNetIncome,
      netAfterTaxYieldPct: optimistic.netAfterTaxYieldPct,
    },
    market: localMarket ? {
      locationLabel: localMarket.place,
      medianSalePricePerSqm: localMarket.refPricePerSqm,
      subjectPricePerSqm: localMarket.yourPricePerSqm,
      rentalDemandScore: tensionToScore(localMarket.tension),
      resaleLiquidityScore: Math.max(25, tensionToScore(localMarket.tension) - 5),
      dataConfidence: "low",
    } : undefined,
    propertyRisk: listing?.dpe ? { dpe: listing.dpe, dataConfidence: "low" } : undefined,
    listingConfidence: listing?.ok ? (listing.confidence ?? "medium") : "unknown",
    locationConfidence: p.lat != null && p.lng != null ? "medium" : p.city ? "low" : "unknown",
  }), [p, realistic, prudent, optimistic, localMarket, listing]);

  async function analyzeUrl(e: FormEvent) {
    e.preventDefault();
    const clean = url.trim();
    if (!clean) return;
    setLoading(true);
    setListing(null);
    try {
      const res = await fetch("/.netlify/functions/analyze-listing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: clean }),
      });
      const data = (await res.json()) as ListingResponse;
      setListing(data);
      if (data.ok) {
        patch({
          listingUrl: clean,
          name: data.title?.slice(0, 70) || p.name,
          price: data.price || p.price,
          surface: data.surface || p.surface,
          city: data.city || p.city,
          postalCode: data.postalCode || p.postalCode,
          address: data.address || p.address,
          lat: data.lat ?? p.lat,
          lng: data.lng ?? p.lng,
        });
      }
    } catch {
      setListing({ ok: false, error: "L’analyse automatique n’est pas disponible sur ce déploiement." });
    } finally {
      setLoading(false);
    }
  }

  function saveProject() {
    const exists = projects.some((x) => x.id === p.id);
    exists ? updateProject(p) : addProject(p);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  const scoreTone = feasibility.score >= 82 ? "excellent" : feasibility.score >= 70 ? "good" : feasibility.score >= 58 ? "watch" : "risk";

  return (
    <div className="space-y-6 pb-6">
      <section className="invest-hero animate-in">
        <div className="invest-kicker"><span className="live-dot" /> Moteur d’analyse immobilière</div>
        <h1>Un lien d’annonce.<br/><span>Une décision d’investisseur.</span></h1>
        <p>
          Patrimoine IA confronte le bien à son financement, au marché local et à un scénario dégradé.
          Les données non vérifiées font volontairement baisser la note.
        </p>
        <form className="listing-search" onSubmit={analyzeUrl}>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Collez une annonce Leboncoin, SeLoger, Bien’ici ou une agence…"
            inputMode="url"
          />
          <button type="submit" disabled={loading || !url.trim()}>
            {loading ? "Analyse…" : "Analyser l’annonce"}
          </button>
        </form>
        <div className="trust-row">
          <span>Extraction de l’annonce</span><span>Marché local</span><span>Stress-test</span><span>Score /100</span>
        </div>
        {listing && (
          <div className={`source-status ${listing.ok ? "ok" : "error"}`}>
            <strong>{listing.ok ? "Annonce analysée" : "Analyse incomplète"}</strong>
            <span>{listing.ok ? `${listing.extracted?.length ?? 0} données détectées${listing.source ? ` · ${listing.source}` : ""}` : listing.error}</span>
            {!!listing.warnings?.length && <small>{listing.warnings.join(" · ")}</small>}
          </div>
        )}
      </section>

      <section className="deal-workspace animate-in">
        <div className="deal-editor">
          <div className="section-heading">
            <div><span className="eyebrow">Données du deal</span><h2>Les chiffres qui pilotent la décision</h2></div>
            <Link to="/projets" className="text-link">Mode expert →</Link>
          </div>

          <div className="quick-grid">
            <label><span>Prix d’achat</span><input type="number" value={p.price} onChange={(e) => patch({ price: +e.target.value })}/><b>€</b></label>
            <label><span>Surface</span><input type="number" value={p.surface ?? 0} onChange={(e) => patch({ surface: +e.target.value })}/><b>m²</b></label>
            <label><span>Loyers / mois</span><input type="number" value={p.monthlyRent} onChange={(e) => patch({ monthlyRent: +e.target.value })}/><b>€</b></label>
            <label><span>Travaux</span><input type="number" value={p.works} onChange={(e) => patch({ works: +e.target.value })}/><b>€</b></label>
            <label><span>Apport</span><input type="number" value={p.downPayment} onChange={(e) => patch({ downPayment: +e.target.value })}/><b>€</b></label>
            <label><span>Taux</span><input type="number" step="0.05" value={p.ratePct} onChange={(e) => patch({ ratePct: +e.target.value })}/><b>%</b></label>
            <label><span>Durée</span><input type="number" value={p.durationYears} onChange={(e) => patch({ durationYears: +e.target.value })}/><b>ans</b></label>
            <label><span>Taxe foncière</span><input type="number" value={p.propertyTaxYearly} onChange={(e) => patch({ propertyTaxYearly: +e.target.value })}/><b>€/an</b></label>
          </div>

          <div className="location-strip">
            <input value={p.city ?? ""} onChange={(e) => patch({ city: e.target.value })} placeholder="Ville" />
            <input value={p.postalCode ?? ""} onChange={(e) => patch({ postalCode: e.target.value })} placeholder="Code postal" />
            <span>{localMarket ? `Référence locale : ${fmtEUR(localMarket.refPricePerSqm)}/m² · tension ${localMarket.tension ?? "à vérifier"}` : "Localisation à renseigner pour comparer le marché"}</span>
          </div>

          <div className="scenario-row">
            {([
              ["Prudent", prudent],
              ["Réaliste", realistic],
              ["Optimiste", optimistic],
            ] as const).map(([label, x]) => (
              <div key={label} className={label === "Réaliste" ? "active" : ""}>
                <span>{label}</span>
                <strong className={x.monthlyCashflow >= 0 ? "positive" : "negative"}>{x.monthlyCashflow >= 0 ? "+" : "−"}{fmtEUR(Math.abs(x.monthlyCashflow))}/mois</strong>
                <small>{fmtPct(x.netAfterTaxYieldPct)} net après fiscalité</small>
              </div>
            ))}
          </div>
        </div>

        <aside className={`feasibility-card ${scoreTone}`}>
          <div className="score-topline"><span>Faisabilité du projet</span><em>Grade {feasibility.grade}</em></div>
          <div className="score-ring" style={{ "--score": `${feasibility.score * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{feasibility.score}</strong><span>/100</span></div>
          </div>
          <h2>{feasibility.verdict}</h2>
          <p className="score-summary">
            {feasibility.score >= 70
              ? "Le dossier présente des fondamentaux intéressants, sous réserve de confirmer les données locales et techniques."
              : "Le dossier demande encore des preuves ou une amélioration du prix / financement avant de devenir robuste."}
          </p>

          <div className="metrics-hero">
            <div><span>Cash-flow</span><strong className={realistic.monthlyCashflow >= 0 ? "positive" : "negative"}>{realistic.monthlyCashflow >= 0 ? "+" : "−"}{fmtEUR(Math.abs(realistic.monthlyCashflow))}</strong></div>
            <div><span>Rentabilité nette</span><strong>{fmtPct(realistic.netAfterTaxYieldPct)}</strong></div>
            <div><span>Prix max CF 0</span><strong>{deal.maxPriceCashflow ? fmtEUR(deal.maxPriceCashflow) : "—"}</strong></div>
          </div>

          <div className="score-components">
            {feasibility.components.map((c) => (
              <div key={c.key}>
                <span>{c.label}<small>{c.weight}%</small></span>
                <div><i style={{ width: `${Math.round(c.score)}%` }}/></div>
                <b>{Math.round(c.score)}</b>
              </div>
            ))}
          </div>

          {feasibility.hardCaps.length > 0 && (
            <div className="score-alert"><strong>Plafond de sécurité</strong><span>{feasibility.hardCaps[0]}</span></div>
          )}

          <button className="save-deal" onClick={saveProject}>{saved ? "✓ Opportunité enregistrée" : "Enregistrer cette opportunité"}</button>
        </aside>
      </section>

      <section className="proof-grid">
        <article><span>01</span><h3>Annonce</h3><p>Extraction automatique des informations accessibles. Une donnée absente reste inconnue : elle n’est jamais inventée.</p></article>
        <article><span>02</span><h3>Localisation</h3><p>Adresse géocodée, prix/m² confronté au marché et profondeur des comparables intégrée à la note.</p></article>
        <article><span>03</span><h3>Résistance</h3><p>Le scénario prudent teste vacance, baisse de loyers, travaux et couverture de dette avant de valider un deal.</p></article>
        <article><span>04</span><h3>Décision</h3><p>Un score élevé exige à la fois rendement, marché solide, résilience et données suffisamment vérifiées.</p></article>
      </section>
    </div>
  );
}
