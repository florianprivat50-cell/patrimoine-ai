import { FormEvent, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { computeDeal, effectiveProjectInputs } from "../lib/deal";
import { projectFeasibility, targetPriceForScore } from '../lib/projectAnalysis';
import { AnalysisEvidence, FieldEvidence, invalidateEvidence } from '../lib/evidence';
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
  extracted?: FieldEvidence[];
  evidence?: AnalysisEvidence;
  monthlyRent?: number;
  propertyTaxYearly?: number;
  yearlyCharges?: number;
  residentialLots?: number;
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
    surface: 0,
    residentialLots: 3,
    commercialLots: 0,
    commercialMonthlyRent: 0,
    analysisMode: "approfondie",
    rentalMode: "classique",
    targetNetYieldPct: 7,
    price: 0,
    agencyFees: 0,
    notaryFeesPct: 8,
    works: 20000,
    furniture: 0,
    bankFees: 1500,
    downPayment: 15000,
    ratePct: 3.5,
    durationYears: 25,
    insurancePctYearly: 0.3,
    monthlyRent: 0,
    monthlyCharges: 180,
    propertyTaxYearly: 0,
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
  const [params] = useSearchParams();
  const [p, setP] = useState<RealEstateProject>(()=>projects.find(x=>x.id===params.get('id')) ?? initialProject());
  const [targetScore,setTargetScore]=useState(80);
  const [targetResult,setTargetResult]=useState<ReturnType<typeof targetPriceForScore>|null>(null);
  const [url, setUrl] = useState("");
  const [listing, setListing] = useState<ListingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const patch = (x: Partial<RealEstateProject>) => {setSaved(false);setTargetResult(null);setP(prev=>({...prev,...x,evidence:invalidateEvidence(prev.evidence,x)}));};
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

  const feasibility = useMemo(()=>projectFeasibility(effective,deal.results),[effective,deal]);
  const valid=p.price>0 && p.monthlyRent>0 && p.durationYears>0 && (p.surface??0)>0;

  async function analyzeUrl(e: FormEvent) {
    e.preventDefault();
    const clean = url.trim();
    if (!clean) return;
    setLoading(true);
    setListing(null);
    setSaved(false);setTargetResult(null);
    const fresh={...initialProject(),propertyType:p.propertyType,listingUrl:clean};
    setP(fresh);
    try {
      const res = await fetch("/.netlify/functions/analyze-listing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: clean, propertyType: p.propertyType }),
      });
      const data = (await res.json()) as ListingResponse;
      setListing(data);
      if (data.ok) {
        setP({...fresh,
          name:data.title?.slice(0,70)||'Annonce à compléter',
          price:data.price??0,surface:data.surface??0,monthlyRent:data.monthlyRent??0,
          propertyTaxYearly:data.propertyTaxYearly??0,monthlyCharges:data.yearlyCharges!=null?data.yearlyCharges/12:fresh.monthlyCharges,
          residentialLots:data.residentialLots??fresh.residentialLots,
          city:data.city??'',postalCode:data.postalCode??'',address:data.address??'',lat:data.lat,lng:data.lng,evidence:data.evidence,
        });
      }
    } catch {
      setListing({ ok: false, error: "L’analyse automatique n’est pas disponible sur ce déploiement." });
    } finally {
      setLoading(false);
    }
  }

  async function refreshLocal(){
    setLoading(true);setTargetResult(null);
    try{
      const res=await fetch('/.netlify/functions/analyze-listing',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'local',manual:{city:p.city,postalCode:p.postalCode,address:p.address,surface:p.surface,price:p.price,propertyType:p.propertyType}})});
      const data=await res.json() as ListingResponse;
      if(data.evidence){const evidence={...data.evidence,fields:p.evidence?.fields??[],risks:p.evidence?.risks??data.evidence.risks};setP(prev=>({...prev,evidence,lat:data.lat,lng:data.lng}));}
      setListing(data);setSaved(false);
    }catch{setListing({ok:false,error:'Collecte locale indisponible. Réessayez.'});}finally{setLoading(false);}
  }
  function saveProject() {
    if(!valid)return;
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
            aria-label="URL de l’annonce"
            disabled={loading}
          />
          <button type="submit" aria-label="Analyser l’annonce" disabled={loading || !url.trim()}>
            {loading ? "Analyse…" : "Analyser l’annonce"}
          </button>
        </form>
        <label className="property-kind">Type à comparer aux ventes DVF <select aria-label="Type de bien" value={p.propertyType} disabled={loading} onChange={e=>patch({propertyType:e.target.value,evidence:undefined})}>{['Immeuble','Appartement','Maison'].map(t=><option key={t}>{t}</option>)}</select></label>
        <div className="trust-row">
          <span>Extraction de l’annonce</span><span>Marché local</span><span>Stress-test</span><span>Score /100</span>
        </div>
        {loading&&<div className="analysis-progress" role="status"><span className="progress-orbit"/><div><strong>Votre dossier prend forme</strong><p>Collecte des informations et vérification des sources disponibles…</p></div><span className="progress-track"/></div>}
        {listing && (
          <div className={`source-status ${listing.ok ? "ok" : "error"}`}>
            <strong>{listing.ok ? "Annonce analysée" : "Analyse incomplète"}</strong>
            <span>{listing.ok ? `${listing.extracted?.length ?? 0} données détectées${listing.source ? ` · ${listing.source}` : ""}` : listing.error}</span>
            {!!listing.warnings?.length && <small>{listing.warnings.join(" · ")}</small>}
          </div>
        )}
      </section>

      <section className="deal-workspace animate-in" aria-busy={loading}>
        <div className="deal-editor">
          <div className="section-heading">
            <div><span className="eyebrow">Données du deal</span><h2>Les chiffres qui pilotent la décision</h2></div>
            <Link to="/projets/expert" className="text-link">Mode expert →</Link>
          </div>

          <p className="analysis-note">Prix, surface et loyers à renseigner avant décision. Les autres montants sont des hypothèses modifiables, pas des données vérifiées.</p>
          <fieldset disabled={loading} className="quick-grid">
            <label><span>Prix d’achat</span><input type="number" min="0" value={p.price} onChange={(e) => patch({ price: +e.target.value })}/><b>€</b></label>
            <label><span>Surface</span><input type="number" value={p.surface ?? 0} onChange={(e) => patch({ surface: +e.target.value })}/><b>m²</b></label>
            <label><span>Loyers / mois</span><input type="number" value={p.monthlyRent} onChange={(e) => patch({ monthlyRent: +e.target.value })}/><b>€</b></label>
            <label><span>Travaux</span><input type="number" value={p.works} onChange={(e) => patch({ works: +e.target.value })}/><b>€</b></label>
            <label><span>Apport</span><input type="number" value={p.downPayment} onChange={(e) => patch({ downPayment: +e.target.value })}/><b>€</b></label>
            <label><span>Taux</span><input type="number" step="0.05" value={p.ratePct} onChange={(e) => patch({ ratePct: +e.target.value })}/><b>%</b></label>
            <label><span>Durée</span><input type="number" min="1" value={p.durationYears} onChange={(e) => patch({ durationYears: +e.target.value })}/><b>ans</b></label>
            <label><span>Taxe foncière</span><input type="number" value={p.propertyTaxYearly} onChange={(e) => patch({ propertyTaxYearly: +e.target.value })}/><b>€/an</b></label>
            <label><span>Charges propriétaire / mois</span><input type="number" min="0" value={p.monthlyCharges} onChange={e=>patch({monthlyCharges:+e.target.value})}/><b>€</b></label>
            <label><span>Vacance (hypothèse)</span><input type="number" min="0" max="99" value={p.vacancyPct} onChange={e=>patch({vacancyPct:+e.target.value})}/><b>%</b></label>
            <label><span>Fiscalité simplifiée</span><input type="number" min="0" max="99" value={p.taxRatePct} onChange={e=>patch({taxRatePct:+e.target.value})}/><b>%</b></label>
            <label><span>Nom du dossier</span><input value={p.name} onChange={e=>patch({name:e.target.value})}/></label>
          </fieldset>

          <div className="location-strip">
            <input value={p.city ?? ""} onChange={(e) => patch({ city: e.target.value })} placeholder="Ville" />
            <input value={p.postalCode ?? ""} onChange={(e) => patch({ postalCode: e.target.value })} placeholder="Code postal" />
            <span>{localMarket ? `Repère indicatif non vérifié : ${fmtEUR(localMarket.refPricePerSqm)}/m² · tension ${localMarket.tension ?? "à vérifier"}` : "Localisation à renseigner pour comparer le marché"}</span>
          </div>

          <button className="save-deal" disabled={loading||(!p.city&&!p.postalCode&&!p.address)} onClick={refreshLocal}>Actualiser le marché et les risques</button>
          <div className="scenario-row" hidden={!valid}>
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
          <div className="score-topline"><span>Faisabilité du projet</span><em>{valid?`Grade ${feasibility.grade}`:"En attente"}</em></div>
          <div className="score-ring" key={feasibility.score} style={{ "--score": `${feasibility.score * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{valid?feasibility.score:"—"}</strong><span>/100</span></div>
          </div>
          <h2>{valid?feasibility.verdict:"À compléter"}</h2>
          <p className="score-summary">
            {feasibility.score >= 70
              ? "Le dossier présente des fondamentaux intéressants, sous réserve de confirmer les données locales et techniques."
              : "Le dossier demande encore des preuves ou une amélioration du prix / financement avant de devenir robuste."}
          </p>

          {valid ? <>
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
            <div className="score-alert"><strong>Plafond de sécurité</strong><span>{feasibility.hardCaps.join(" ")}</span></div>
          )}

          </> : <p className="analysis-note">Renseignez le prix, la surface et les loyers pour découvrir le score et les scénarios de votre investissement.</p>}
          <button className={`save-deal ${saved?"is-saved":""}`} disabled={!valid||loading} onClick={saveProject}>{saved ? "✓ Opportunité enregistrée" : "Enregistrer cette opportunité"}</button>
        </aside>
      </section>

      <section className="evidence-panel">
        <h2>Prix cible et preuves du dossier</h2>
        <div className="target-controls"><label>Score visé <input aria-label="Score visé" type="number" min="1" max="100" value={targetScore} onChange={e=>{setTargetScore(+e.target.value);setTargetResult(null);}}/></label><button className="save-deal" disabled={!valid} onClick={()=>setTargetResult(targetPriceForScore(effective,targetScore))}>Calculer le prix cible</button></div>
        {targetResult&&<p role="status">{targetResult.price!=null?fmtEUR(targetResult.price):'Objectif inaccessible par le prix seul'} · {targetResult.reason}</p>}
        <p className="analysis-note">Scénario prudent : loyers −5 %, vacance +5 points, travaux +15 %. Fiscalité simplifiée sur le revenu net ; à adapter au régime réel. DSCR réaliste : {Number.isFinite(feasibility.dscrRealistic)?feasibility.dscrRealistic.toFixed(2):'—'}.</p>
        {p.evidence?<>
          <p>Collecte du {new Date(p.evidence.retrievedAt).toLocaleDateString('fr-FR')} · {p.evidence.location?.label??'Localisation non confirmée'}</p>
          {p.evidence.sources.map((source,i)=><article className="evidence-source" key={i}><a href={source.url} target="_blank" rel="noreferrer">{source.name} ↗</a><b>{source.status==='available'?'Source reçue':source.status==='insufficient'?'À préciser':'Indisponible'}</b><p>{source.detail}</p></article>)}
          {p.evidence.market.medianSalePricePerSqm&&<p>Médiane des ventes comparables : {fmtEUR(p.evidence.market.medianSalePricePerSqm)}/m² · {p.evidence.market.comparableSaleCount} ventes.</p>}
          {!!p.evidence.comparables?.length&&<details><summary>Ventes retenues (jusqu’à 50)</summary>{p.evidence.comparables.map(c=><p key={c.id}>{c.date} · {c.surface} m² · {fmtEUR(c.price)} · {fmtEUR(c.pricePerSqm)}/m² · mutation {c.id}</p>)}</details>}
          <p>Risques communaux : {p.evidence.riskLabels.join(', ')||'Non déterminés'}. Ce relevé ne remplace pas l’état des risques de la parcelle.</p>
          <details><summary>Données extraites et contradictions</summary>{p.evidence.fields.map((f,i)=><p key={i}><b>{f.field}</b> : {f.alternatives?.join(' / ')??f.value} · {f.status==='conflict'?'Contradiction à résoudre':f.status==='manual'?'Saisie manuelle':'Déclaration vendeur'} · {f.source}</p>)}</details>
          <ul>{p.evidence.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>
        </>:<p>Aucune preuve collectée. Les calculs reposent sur vos saisies et hypothèses.</p>}
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
