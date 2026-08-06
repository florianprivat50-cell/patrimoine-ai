import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Field, NumberInput, PageHeader, SectionTitle } from "../components/ui";
import { IconDownload, IconMap, IconPin, IconPlus } from "../components/icons";
import { useCountUp } from "../hooks/useCountUp";
import { computeDeal, DealAnalysis, effectiveProjectInputs, VERDICT_META } from "../lib/deal";
import { fmtEUR, fmtPct } from "../lib/finance";
import { geocode } from "../lib/geo";
import { SCENARIO_LABELS, ScenarioKind } from "../lib/realestate";
import { useStore, uid } from "../store";
import { RealEstateProject, RealEstateProjectInputs } from "../types";

const PROPERTY_TYPES = ["Immeuble", "Appartement", "Maison", "Local commercial", "Autre"];

function defaultProject(): RealEstateProject {
  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    name: "",
    city: "",
    postalCode: "",
    address: "",
    listingUrl: "",
    propertyType: "Immeuble",
    surface: 145,
    residentialLots: 2,
    commercialLots: 1,
    commercialMonthlyRent: 500,
    analysisMode: "express",
    rentalMode: "classique",
    nightlyRate: 70,
    occupancyPct: 60,
    targetNetYieldPct: 7,
    price: 182960,
    agencyFees: 0,
    notaryFeesPct: 8,
    works: 25000,
    furniture: 0,
    bankFees: 1500,
    downPayment: 20000,
    ratePct: 3.5,
    durationYears: 25,
    insurancePctYearly: 0.3,
    monthlyRent: 900,
    monthlyCharges: 200,
    propertyTaxYearly: 1700,
    ownerInsuranceYearly: 450,
    managementPct: 0,
    maintenancePct: 5,
    vacancyPct: 8,
    taxRatePct: 30,
    rentGrowthPct: 1,
    valueGrowthPct: 1,
  };
}

export default function Projets() {
  const { projects, addProject, updateProject, removeProject } = useStore();
  const [p, setP] = useState<RealEstateProject>(defaultProject);
  const [savedFlash, setSavedFlash] = useState(false);
  const navigate = useNavigate();
  const set = (patch: Partial<RealEstateProject>) => setP((prev) => ({ ...prev, ...patch }));

  const effective = useMemo(() => effectiveProjectInputs(p), [p]);
  const deal = useMemo(() => computeDeal(effective), [effective]);
  const isSaved = projects.some((x) => x.id === p.id);

  const save = () => {
    const rec = { ...p, name: p.name.trim() || `${p.propertyType} — ${p.city || "sans ville"}` };
    isSaved ? updateProject(rec) : addProject(rec);
    setP(rec);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analyser un bien"
        subtitle="En quelques minutes : rentabilité réelle, résistance du projet, prix maximal et décision argumentée."
        actions={
          <>
            {p.lat != null && p.lng != null && (
              <button className="btn-ghost flex items-center gap-1.5 !py-2 text-sm" onClick={() => navigate("/carte")}>
                <IconMap size={16} /> Voir sur la carte
              </button>
            )}
            <button className="btn-ghost flex items-center gap-1.5 !py-2 text-sm" onClick={() => window.print()}>
              <IconDownload size={16} /> Rapport PDF
            </button>
          </>
        }
      />

      {projects.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Opportunités
          </span>
          {projects.map((proj) => (
            <span
              key={proj.id}
              className="flex shrink-0 items-center gap-1 rounded-full py-1 pl-3 pr-1 text-xs font-medium"
              style={{
                border: `1px solid ${proj.id === p.id ? "var(--accent)" : "var(--border)"}`,
                color: proj.id === p.id ? "var(--accent)" : "var(--text-secondary)",
                background: "var(--surface-1)",
              }}
            >
              <button onClick={() => setP(proj)}>{proj.name || "Sans nom"}</button>
              <button
                aria-label={`Supprimer ${proj.name}`}
                className="flex h-5 w-5 items-center justify-center rounded-full"
                style={{ color: "var(--text-muted)" }}
                onClick={() => {
                  if (confirm(`Supprimer l'opportunité « ${proj.name} » ?`)) {
                    removeProject(proj.id);
                    if (proj.id === p.id) setP(defaultProject());
                  }
                }}
              >
                ×
              </button>
            </span>
          ))}
          <button
            className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ border: "1px dashed var(--border)", color: "var(--text-muted)" }}
            onClick={() => setP(defaultProject())}
          >
            <IconPlus size={13} strokeWidth={2.2} /> Nouvelle analyse
          </button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ————— Colonne hypothèses ————— */}
        <div className="card h-fit">
          <SectionTitle>Hypothèses du projet</SectionTitle>

          <div className="grid grid-cols-2 gap-2">
            <button
              className="seg-btn"
              data-active={p.analysisMode !== "approfondie"}
              onClick={() => set({ analysisMode: "express" })}
            >
              Analyse express
              <span className="mt-0.5 block text-[11px] font-normal" style={{ color: "var(--text-muted)" }}>
                Hypothèses prudentes du marché appliquées d'office
              </span>
            </button>
            <button
              className="seg-btn"
              data-active={p.analysisMode === "approfondie"}
              onClick={() => set({ analysisMode: "approfondie" })}
            >
              Analyse approfondie
              <span className="mt-0.5 block text-[11px] font-normal" style={{ color: "var(--text-muted)" }}>
                Charges, vacance, gestion, fiscalité : réglage détaillé
              </span>
            </button>
            <button
              className="seg-btn"
              data-active={p.rentalMode !== "saisonnier"}
              onClick={() => set({ rentalMode: "classique" })}
            >
              Location classique
              <span className="mt-0.5 block text-[11px] font-normal" style={{ color: "var(--text-muted)" }}>
                Loyer mensuel, bail nu ou meublé
              </span>
            </button>
            <button
              className="seg-btn"
              data-active={p.rentalMode === "saisonnier"}
              onClick={() => set({ rentalMode: "saisonnier" })}
            >
              Airbnb / saisonnier
              <span className="mt-0.5 block text-[11px] font-normal" style={{ color: "var(--text-muted)" }}>
                Prix par nuit et taux d'occupation
              </span>
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="Nom du dossier">
              <input className="input" value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex : Immeuble centre-ville" />
            </Field>
            <Field label="Ville">
              <input className="input" value={p.city ?? ""} onChange={(e) => set({ city: e.target.value })} placeholder="Ex : Avranches" />
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Field
              label="Code postal"
              hint="Sert de repli au niveau du département si la ville n'est pas dans notre référentiel — c'est ce qui garantit une comparaison de marché même pour une petite commune."
            >
              <input
                className="input"
                inputMode="numeric"
                value={p.postalCode ?? ""}
                onChange={(e) => set({ postalCode: e.target.value })}
                placeholder="Ex : 50300"
                maxLength={5}
              />
            </Field>
            <div className="col-span-2">
              <Field label="Adresse exacte" hint="Utilisée pour placer le bien sur la carte.">
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={p.address ?? ""}
                  onChange={(e) => set({ address: e.target.value, lat: undefined, lng: undefined })}
                  placeholder="Ex : 12 rue de la Liberté, Avranches"
                />
                <LocateButton project={p} onLocated={(lat, lng) => set({ lat, lng })} />
              </div>
              {p.lat != null && p.lng != null && (
                <span className="hint" style={{ color: "var(--good-text)" }}>
                  ✓ Localisé — visible sur la carte
                </span>
              )}
              </Field>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Type de bien">
              <select className="input" value={p.propertyType} onChange={(e) => set({ propertyType: e.target.value })}>
                {PROPERTY_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Surface">
              <NumberInput value={p.surface} onChange={(v) => set({ surface: v })} suffix="m²" min={0} />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Lien de l'annonce">
              <input className="input" value={p.listingUrl ?? ""} onChange={(e) => set({ listingUrl: e.target.value })} placeholder="https://…" />
            </Field>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Lots d'habitation">
              <NumberInput value={p.residentialLots} onChange={(v) => set({ residentialLots: v })} suffix="logts" min={0} />
            </Field>
            <Field label="Locaux commerciaux">
              <NumberInput value={p.commercialLots} onChange={(v) => set({ commercialLots: v })} suffix="locaux" min={0} />
            </Field>
            <Field label="Prix affiché">
              <NumberInput value={p.price} onChange={(v) => set({ price: v })} suffix="€" min={0} />
            </Field>
            <Field label="Frais de notaire">
              <NumberInput value={p.notaryFeesPct} onChange={(v) => set({ notaryFeesPct: v })} suffix="%" min={0} step={0.5} />
            </Field>
            <Field label="Travaux">
              <NumberInput value={p.works} onChange={(v) => set({ works: v })} suffix="€" min={0} />
            </Field>
            {p.rentalMode === "saisonnier" ? (
              <Field label="Tarif moyen par nuit">
                <NumberInput value={p.nightlyRate} onChange={(v) => set({ nightlyRate: v })} suffix="€" min={0} />
              </Field>
            ) : (
              <Field label="Loyers mensuels des logements">
                <NumberInput value={p.monthlyRent} onChange={(v) => set({ monthlyRent: v })} suffix="€" min={0} />
              </Field>
            )}
            {p.rentalMode === "saisonnier" ? (
              <Field label="Taux d'occupation" hint="Moyenne annuelle réaliste : 50–65 % hors zones très touristiques.">
                <NumberInput value={p.occupancyPct} onChange={(v) => set({ occupancyPct: v })} suffix="%" min={0} />
              </Field>
            ) : (
              (p.commercialLots ?? 0) > 0 && (
                <Field label="Loyer mensuel commercial">
                  <NumberInput value={p.commercialMonthlyRent} onChange={(v) => set({ commercialMonthlyRent: v })} suffix="€" min={0} />
                </Field>
              )
            )}
            <Field label="Charges annuelles" hint="Copropriété, eau, entretien courant.">
              <NumberInput
                value={Math.round(p.monthlyCharges * 12)}
                onChange={(v) => set({ monthlyCharges: v / 12 })}
                suffix="€"
                min={0}
              />
            </Field>
            <Field label="Taxe foncière">
              <NumberInput value={p.propertyTaxYearly} onChange={(v) => set({ propertyTaxYearly: v })} suffix="€" min={0} />
            </Field>
            <Field label="Apport">
              <NumberInput value={p.downPayment} onChange={(v) => set({ downPayment: v })} suffix="€" min={0} />
            </Field>
          </div>

          {p.analysisMode !== "approfondie" && (
            <div
              className="mt-4 rounded-xl p-3 text-[12px] leading-relaxed"
              style={{ background: "color-mix(in srgb, var(--warning) 12%, transparent)", color: "var(--text-secondary)" }}
            >
              <strong style={{ color: "var(--text-primary)" }}>Hypothèses de sécurité appliquées.</strong>{" "}
              Vacance {p.rentalMode === "saisonnier" ? "intégrée à l'occupation" : "8 %"}, assurance emprunteur 0,3 %,
              PNO {150 * Math.max(1, (p.residentialLots ?? 1) + (p.commercialLots ?? 0))} €/an, entretien{" "}
              {p.rentalMode === "saisonnier" ? "12" : "5"} % des loyers, fiscalité 30 % du résultat. Passer en analyse
              approfondie pour les modifier.
            </div>
          )}

          <div className="mt-4">
            <SectionTitle>Financement et objectif</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Taux du crédit">
                <NumberInput value={p.ratePct} onChange={(v) => set({ ratePct: v })} suffix="%" min={0} step={0.05} />
              </Field>
              <Field label="Durée">
                <NumberInput value={p.durationYears} onChange={(v) => set({ durationYears: v })} suffix="ans" min={1} />
              </Field>
              <Field label="Rentabilité nette cible" hint="Sert au calcul du prix maximal acceptable.">
                <NumberInput value={p.targetNetYieldPct} onChange={(v) => set({ targetNetYieldPct: v })} suffix="%" min={0} step={0.5} />
              </Field>
            </div>
          </div>

          {p.analysisMode === "approfondie" && (
            <div className="mt-4">
              <SectionTitle>Réglages détaillés</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Frais d'agence">
                  <NumberInput value={p.agencyFees} onChange={(v) => set({ agencyFees: v })} suffix="€" min={0} />
                </Field>
                <Field label="Ameublement">
                  <NumberInput value={p.furniture} onChange={(v) => set({ furniture: v })} suffix="€" min={0} />
                </Field>
                <Field label="Frais bancaires / garantie">
                  <NumberInput value={p.bankFees} onChange={(v) => set({ bankFees: v })} suffix="€" min={0} />
                </Field>
                <Field label="Assurance emprunteur">
                  <NumberInput value={p.insurancePctYearly} onChange={(v) => set({ insurancePctYearly: v })} suffix="%/an" min={0} step={0.05} />
                </Field>
                <Field label="Assurance PNO / an">
                  <NumberInput value={p.ownerInsuranceYearly} onChange={(v) => set({ ownerInsuranceYearly: v })} suffix="€" min={0} />
                </Field>
                <Field label="Gestion locative">
                  <NumberInput value={p.managementPct} onChange={(v) => set({ managementPct: v })} suffix="%" min={0} />
                </Field>
                <Field label="Provision entretien">
                  <NumberInput value={p.maintenancePct} onChange={(v) => set({ maintenancePct: v })} suffix="%" min={0} />
                </Field>
                <Field label="Vacance locative">
                  <NumberInput value={p.vacancyPct} onChange={(v) => set({ vacancyPct: v })} suffix="%" min={0} />
                </Field>
                <Field label="Fiscalité estimée" hint="TMI + PS, ou ≈ 0 en LMNP réel amorti.">
                  <NumberInput value={p.taxRatePct} onChange={(v) => set({ taxRatePct: v })} suffix="%" min={0} />
                </Field>
                <Field label="Revalorisation loyers / an">
                  <NumberInput value={p.rentGrowthPct} onChange={(v) => set({ rentGrowthPct: v })} suffix="%" step={0.1} />
                </Field>
                <Field label="Évolution du bien / an">
                  <NumberInput value={p.valueGrowthPct} onChange={(v) => set({ valueGrowthPct: v })} suffix="%" step={0.1} />
                </Field>
              </div>
            </div>
          )}
        </div>

        {/* ————— Colonne décision ————— */}
        <DecisionPanel deal={deal} p={p} effective={effective} onSave={save} savedFlash={savedFlash} isSaved={isSaved} />
      </div>
    </div>
  );
}

function PanelRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="deal-card">
      <div className="text-[11px]" style={{ color: "var(--panel-muted)" }}>
        {label}
      </div>
      <div className="mt-0.5 text-[15px] font-bold" style={{ color: accent ? "var(--panel-mint)" : "var(--panel-text)" }}>
        {value}
      </div>
    </div>
  );
}

function DecisionPanel({
  deal,
  p,
  effective,
  onSave,
  savedFlash,
  isSaved,
}: {
  deal: DealAnalysis;
  p: RealEstateProject;
  effective: RealEstateProjectInputs;
  onSave: () => void;
  savedFlash: boolean;
  isSaved: boolean;
}) {
  const [showScoreDetail, setShowScoreDetail] = useState(false);
  const r = deal.results.realiste;
  const meta = VERDICT_META[deal.verdict];
  const cf = r.monthlyCashflow;
  const scoreColor = deal.score >= 65 ? "var(--panel-mint-strong)" : deal.score >= 45 ? "var(--panel-amber)" : "var(--panel-orange)";
  const animatedScore = useCountUp(deal.score, 700);
  const [scoreBarPct, setScoreBarPct] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setScoreBarPct(deal.score), 60);
    return () => clearTimeout(t);
  }, [deal.score]);

  return (
    <div className="deal-panel space-y-3.5 lg:sticky lg:top-4 lg:h-fit" id="rapport">
      {/* Verdict */}
      <div key={deal.verdict} className="deal-card animate-scale-in flex items-center gap-3">
        <span
          className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-extrabold tracking-wide text-white ${deal.verdict === "accepter" ? "animate-pulse-glow" : ""}`}
          style={{ background: meta.color, color: deal.verdict === "accepter" ? "#06281c" : "#fff" }}
        >
          {meta.label}
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--panel-muted)" }}>
            Décision au prix actuel
          </div>
          <div className="truncate text-[13px]" style={{ color: "var(--panel-text)" }}>
            {p.name || `${p.propertyType}${p.city ? ` — ${p.city}` : ""}`} · {fmtEUR(p.price)}
          </div>
        </div>
      </div>

      {/* Score */}
      <div className="deal-card">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--panel-muted)" }}>
              Score investissement
            </div>
            <button
              className="mt-0.5 text-[11px] underline-offset-2 hover:underline"
              style={{ color: "var(--panel-muted)" }}
              onClick={() => setShowScoreDetail(!showScoreDetail)}
            >
              {showScoreDetail ? "Masquer le détail" : "Comment ce score est calculé ?"}
            </button>
          </div>
          <div className="font-display text-4xl tracking-tight tabular-nums" style={{ color: scoreColor }}>
            {Math.round(animatedScore)}
            <span className="text-base font-semibold" style={{ color: "var(--panel-muted)" }}>
              /100
            </span>
          </div>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.12)" }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${scoreBarPct}%`, background: scoreColor, transition: "width 0.9s cubic-bezier(0.16,1,0.3,1)" }}
          />
        </div>
        {showScoreDetail && (
          <ul className="mt-3 space-y-1.5 text-[12px]" style={{ color: "var(--panel-muted)" }}>
            {deal.scoreParts.map((s) => (
              <li key={s.label} className="flex justify-between gap-3">
                <span>
                  {s.label} — {s.comment}
                </span>
                <span className="shrink-0 font-bold" style={{ color: "var(--panel-text)" }}>
                  {s.points}/{s.max}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Lecture IA */}
      <div className="deal-card" style={{ borderColor: "color-mix(in srgb, var(--panel-mint) 35%, transparent)" }}>
        <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--panel-mint)" }}>
          La décision, argumentée
        </div>
        <p className="mt-1 text-[15px] font-bold leading-snug" style={{ color: "var(--panel-text)" }}>
          {deal.headline}
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--panel-muted)" }}>
          {deal.advice}
        </p>
      </div>

      {/* Points forts / risques / visite */}
      <div className="grid gap-2 sm:grid-cols-3">
        {(
          [
            ["Points forts", deal.strengths, "var(--panel-mint)"],
            ["Risques & challenges", deal.risks, "var(--panel-orange)"],
            ["Questions de visite", deal.visitQuestions, "var(--panel-amber)"],
          ] as [string, string[], string][]
        ).map(([title, items, color], i) => (
          <div key={title} className={`deal-card animate-in delay-${i + 1}`}>
            <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color }}>
              {title}
            </div>
            <ul className="mt-1.5 space-y-1.5 text-[11.5px] leading-snug" style={{ color: "var(--panel-muted)" }}>
              {items.map((x, i) => (
                <li key={i}>• {x}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Cash-flow héros */}
      <div className="deal-card flex items-center justify-between">
        <div className="text-[12px] font-semibold" style={{ color: "var(--panel-muted)" }}>
          Cash-flow mensuel
          <span className="block text-[10px] font-normal">après fiscalité estimée</span>
        </div>
        <div className="font-display text-3xl tracking-tight" style={{ color: cf >= 0 ? "var(--panel-mint-strong)" : "var(--panel-orange)" }}>
          {cf >= 0 ? "+" : "−"}
          {fmtEUR(Math.abs(cf))}
        </div>
      </div>

      {/* Scénarios */}
      <div className="grid grid-cols-3 gap-2">
        {(["prudent", "realiste", "optimiste"] as ScenarioKind[]).map((k, i) => {
          const res = deal.results[k];
          const active = k === "realiste";
          return (
            <div
              key={k}
              className={`deal-card animate-in delay-${i + 4} !p-2.5 text-center`}
              style={active ? { borderColor: "var(--panel-mint)", background: "var(--panel-card-solid)" } : undefined}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: active ? "var(--panel-mint)" : "var(--panel-muted)" }}>
                {SCENARIO_LABELS[k]}
              </div>
              <div
                className="mt-1 text-[15px] font-extrabold"
                style={{ color: res.monthlyCashflow >= 0 ? "var(--panel-mint-strong)" : "var(--panel-orange)" }}
              >
                {res.monthlyCashflow >= 0 ? "+" : "−"}
                {fmtEUR(Math.abs(res.monthlyCashflow))}
                <span className="text-[10px] font-medium" style={{ color: "var(--panel-muted)" }}>
                  /mois
                </span>
              </div>
              <div className="text-[10px]" style={{ color: "var(--panel-muted)" }}>
                {fmtPct(res.netAfterTaxYieldPct)} net
              </div>
            </div>
          );
        })}
      </div>

      {/* Indicateurs détaillés */}
      <div className="grid grid-cols-2 gap-2">
        <PanelRow label="Type de bien" value={`${p.propertyType ?? "—"}${p.rentalMode === "saisonnier" ? " · saisonnier" : ""}`} />
        <PanelRow label="Coût total du projet" value={fmtEUR(r.totalCost)} />
        <PanelRow label="Mensualité + assurance" value={`${fmtEUR(r.monthlyLoanPayment)}/mois`} />
        <PanelRow label="Revenus locatifs annuels" value={fmtEUR(r.grossMonthlyRent * 12)} />
        <PanelRow label="Rentabilité brute" value={fmtPct(r.grossYieldPct)} />
        <PanelRow label="Nette après fiscalité" value={fmtPct(r.netAfterTaxYieldPct)} accent={r.netAfterTaxYieldPct >= (p.targetNetYieldPct ?? 7)} />
        <PanelRow label="Prix au m²" value={deal.pricePerSqm ? `${fmtEUR(deal.pricePerSqm)}/m²` : "—"} />
        <PanelRow label="Coût moyen par lot" value={deal.costPerLot ? fmtEUR(deal.costPerLot) : "—"} />
        <PanelRow
          label="Lots"
          value={`${p.residentialLots ?? 0} logement${(p.residentialLots ?? 0) > 1 ? "s" : ""}${(p.commercialLots ?? 0) > 0 ? ` + ${p.commercialLots} local` : ""}`}
        />
        <PanelRow
          label="Part du loyer commercial"
          value={deal.commercialSharePct > 0 ? fmtPct(deal.commercialSharePct, 0) : "—"}
        />
        <PanelRow label="Loyer d'équilibre" value={`${fmtEUR(r.breakEvenRent)}/mois`} />
        <PanelRow
          label="Marge sur l'équilibre"
          value={deal.rentMarginPct === null ? "—" : `${deal.rentMarginPct >= 0 ? "+" : ""}${fmtPct(deal.rentMarginPct, 0)}`}
          accent={deal.rentMarginPct !== null && deal.rentMarginPct >= 0}
        />
      </div>

      {/* Marché local */}
      <MarketCard deal={deal} city={p.city} postalCode={p.postalCode} />

      {/* Prix cibles */}
      <div className="grid grid-cols-2 gap-2">
        <div className="deal-card" style={{ borderColor: "color-mix(in srgb, var(--panel-mint) 40%, transparent)" }}>
          <div className="text-[11px] font-semibold" style={{ color: "var(--panel-mint)" }}>
            Offre de déclenchement
          </div>
          <div className="mt-0.5 text-xl font-extrabold" style={{ color: "var(--panel-mint)" }}>
            {deal.offerPrice ? fmtEUR(deal.offerPrice) : "—"}
          </div>
          <div className="text-[10px]" style={{ color: "var(--panel-muted)" }}>
            marge de négociation 3 % incluse
          </div>
        </div>
        <PanelRow
          label={`Prix max pour ${fmtPct(p.targetNetYieldPct ?? 7, 1)} net`}
          value={deal.maxPriceTarget ? fmtEUR(deal.maxPriceTarget) : "cible hors d'atteinte"}
        />
        <PanelRow label="Prix max cash-flow neutre" value={deal.maxPriceCashflow ? fmtEUR(deal.maxPriceCashflow) : "—"} />
        <PanelRow
          label="Écart vs prix affiché"
          value={
            deal.offerPrice
              ? `${fmtPct(((deal.offerPrice - p.price) / p.price) * 100, 0)}`
              : "—"
          }
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-bold transition active:scale-[0.98]"
          style={{ background: "var(--panel-mint-strong)", color: "#06281c" }}
          onClick={onSave}
        >
          {!savedFlash && <IconPlus size={16} strokeWidth={2.2} />}
          {savedFlash ? "Enregistré" : isSaved ? "Mettre à jour l'opportunité" : "Enregistrer dans Opportunités"}
        </button>
        <button
          className="flex items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold transition"
          style={{ border: "1px solid var(--panel-border)", color: "var(--panel-text)" }}
          onClick={() => window.print()}
        >
          <IconDownload size={16} /> Rapport PDF
        </button>
      </div>

      <p className="text-[10px] leading-relaxed" style={{ color: "var(--panel-muted)" }}>
        Simulation indicative fondée sur vos hypothèses (vacance {fmtPct(effective.vacancyPct, 0)}, fiscalité{" "}
        {fmtPct(effective.taxRatePct, 0)}, entretien {fmtPct(effective.maintenancePct, 0)} des loyers). Le détail du
        score est consultable ci-dessus ; les évolutions de marché restent incertaines. Ceci n'est pas un conseil en
        investissement.
      </p>
    </div>
  );
}

function MarketCard({ deal, city, postalCode }: { deal: DealAnalysis; city?: string; postalCode?: string }) {
  const m = deal.market;

  if (!m) {
    return (
      <div className="deal-card">
        <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--panel-muted)" }}>
          Marché local
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--panel-muted)" }}>
          {city?.trim() && !postalCode?.trim()
            ? `« ${city} » n'est pas dans notre base de villes précises. Ajoutez le code postal pour comparer au moins à la moyenne du département.`
            : postalCode?.trim()
              ? `Code postal « ${postalCode} » non reconnu — vérifiez qu'il comporte 5 chiffres.`
              : "Renseignez la ville et le code postal pour comparer ce prix au marché local."}
        </p>
      </div>
    );
  }

  // Position sur une jauge -30% (sous-coté) → +30% (sur-évalué), centrée sur 0
  const posPct = clamp((m.gapPct + 30) / 60, 0, 1) * 100;
  const gapColor = m.gapPct <= -5 ? "var(--panel-mint-strong)" : m.gapPct <= 10 ? "var(--panel-amber)" : "var(--panel-orange)";

  return (
    <div className="deal-card">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--panel-muted)" }}>
          Marché local — {m.place}
        </div>
        <span className="text-[11px] font-bold" style={{ color: gapColor }}>
          {m.label}
        </span>
      </div>
      {m.precision === "departement" && (
        <div className="mt-0.5 text-[10px]" style={{ color: "var(--panel-amber)" }}>
          Estimation départementale — ville non répertoriée précisément
        </div>
      )}
      {m.precision === "arrondissement" && (
        <div className="mt-0.5 text-[10px]" style={{ color: "var(--panel-mint)" }}>
          Précision maximale — donnée par arrondissement
        </div>
      )}

      <div className="mt-2 flex items-baseline justify-between text-[12px]" style={{ color: "var(--panel-muted)" }}>
        <span>
          Vous : <strong style={{ color: "var(--panel-text)" }}>{fmtEUR(m.yourPricePerSqm)}/m²</strong>
        </span>
        <span>
          Marché : <strong style={{ color: "var(--panel-text)" }}>{fmtEUR(m.refPricePerSqm)}/m²</strong>
        </span>
      </div>

      <div className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.12)" }}>
        <div className="absolute inset-y-0" style={{ left: "50%", width: 1, background: "rgba(255,255,255,0.35)" }} />
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full"
          style={{ left: `calc(${posPct}% - 5px)`, background: gapColor, transition: "left 0.7s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px]" style={{ color: "var(--panel-muted)" }}>
        <span>−30 %</span>
        <span>marché</span>
        <span>+30 %</span>
      </div>

      <p className="mt-2 text-[12px]" style={{ color: "var(--panel-text)" }}>
        Écart de <strong style={{ color: gapColor }}>{m.gapPct >= 0 ? "+" : ""}{fmtPct(m.gapPct, 0)}</strong> vs la
        moyenne locale
        {m.tension && (
          <>
            {" "}
            · tension locative <strong>{m.tension}</strong>
          </>
        )}
        .
      </p>
      <p className="mt-1.5 text-[10px] leading-relaxed" style={{ color: "var(--panel-muted)" }}>
        Estimation indicative (ordre de grandeur), non connectée à un flux temps réel — à confirmer via DVF, notaire
        ou agences avant toute décision.
      </p>
    </div>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function LocateButton({
  project,
  onLocated,
}: {
  project: RealEstateProject;
  onLocated: (lat: number, lng: number) => void;
}) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const run = async () => {
    const query = [project.address, project.postalCode, project.city, "France"].filter(Boolean).join(", ");
    if (!project.address?.trim() && !project.city?.trim()) {
      setState("error");
      return;
    }
    setState("loading");
    const pt = await geocode(query);
    if (pt) {
      onLocated(pt.lat, pt.lng);
      setState("idle");
    } else {
      setState("error");
    }
  };

  return (
    <button
      type="button"
      className="btn-ghost flex shrink-0 items-center gap-1.5 !px-3 text-sm"
      onClick={run}
      disabled={state === "loading"}
      title="Géocoder l'adresse via OpenStreetMap"
    >
      <IconPin size={15} />
      {state === "loading" ? "…" : state === "error" ? "Réessayer" : "Localiser"}
    </button>
  );
}
