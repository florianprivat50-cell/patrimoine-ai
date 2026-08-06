import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge, CalcDetail, Card, EmptyState, Field, Modal, NumberInput, PageHeader, SectionTitle } from "../components/ui";
import { IconPin, IconPlus } from "../components/icons";
import { fmtEUR, fmtPct, remainingInterest } from "../lib/finance";
import { geocode } from "../lib/geo";
import { compareToMarket } from "../lib/market";
import { useStore, uid } from "../store";
import {
  Asset,
  AssetCategory,
  CATEGORY_COLORS_DARK,
  CATEGORY_COLORS_LIGHT,
  CATEGORY_LABELS,
  Liability,
  LiabilityType,
} from "../types";

const SUBTYPES: Record<AssetCategory, string[]> = {
  immobilier: [
    "Résidence principale",
    "Résidence secondaire",
    "Appartement locatif",
    "Maison locative",
    "Immeuble de rapport",
    "Local commercial",
    "Terrain",
    "Parking",
    "SCPI",
    "Nue-propriété",
    "Usufruit",
    "Indivision",
  ],
  liquidites: ["Compte courant", "Livret A", "LDDS", "LEP", "Compte à terme", "Espèces", "Autre livret"],
  financier: [
    "PEA",
    "Compte-titres",
    "Assurance-vie",
    "PER",
    "Actions",
    "ETF",
    "Obligations",
    "Fonds",
    "Private equity",
    "Crowdfunding",
  ],
  crypto: ["Bitcoin", "Ethereum", "Autre cryptomonnaie", "Stablecoin"],
  societe: ["SARL", "SAS", "SCI", "Holding", "Entreprise individuelle", "Parts sociales", "Compte courant d'associé"],
  autre: ["Véhicule", "Montre", "Objet de collection", "Métaux précieux", "Œuvre d'art", "Matériel professionnel", "Créance", "Autre"],
};

const LIABILITY_TYPES: LiabilityType[] = [
  "Crédit immobilier",
  "Crédit automobile",
  "Crédit à la consommation",
  "Prêt étudiant",
  "Crédit professionnel",
  "Prêt familial",
  "Dette fiscale",
  "Crédit renouvelable",
  "Prêt in fine",
  "Autre dette",
];

export default function Patrimoine() {
  const { assets, liabilities, addAsset, updateAsset, removeAsset, addLiability, updateLiability, removeLiability } =
    useStore();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<"actifs" | "credits">("actifs");
  const [editingAsset, setEditingAsset] = useState<Asset | "new" | null>(null);
  const [editingLiab, setEditingLiab] = useState<Liability | "new" | null>(null);

  useEffect(() => {
    if (params.get("ajouter")) {
      setEditingAsset("new");
      params.delete("ajouter");
      setParams(params, { replace: true });
    }
  }, [params]);

  const isDark = document.documentElement.classList.contains("dark");
  const colors = isDark ? CATEGORY_COLORS_DARK : CATEGORY_COLORS_LIGHT;

  const grouped = useMemo(() => {
    const g = new Map<AssetCategory, Asset[]>();
    for (const a of assets) g.set(a.category, [...(g.get(a.category) ?? []), a]);
    return g;
  }, [assets]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Patrimoine"
        subtitle="Comptes, biens, placements et crédits centralisés"
        actions={
          <button
            className="btn-primary flex items-center gap-1.5 !py-2 text-sm"
            onClick={() => (tab === "actifs" ? setEditingAsset("new") : setEditingLiab("new"))}
          >
            <IconPlus size={16} strokeWidth={2.2} /> Ajouter
          </button>
        }
      />

      <div className="flex gap-2">
        {(["actifs", "credits"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="rounded-full px-4 py-2 text-sm font-medium transition"
            style={{
              background: tab === t ? "var(--accent)" : "var(--surface-1)",
              color: tab === t ? "#fff" : "var(--text-secondary)",
              border: `1px solid ${tab === t ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            {t === "actifs" ? `Actifs (${assets.length})` : `Crédits & dettes (${liabilities.length})`}
          </button>
        ))}
      </div>

      {tab === "actifs" &&
        (assets.length === 0 ? (
          <EmptyState
            title="Aucun actif pour l'instant"
            body="Ajoutez vos comptes, biens immobiliers, placements et cryptomonnaies pour voir votre patrimoine net."
            cta={
              <button className="btn-primary" onClick={() => setEditingAsset("new")}>
                Ajouter un premier actif
              </button>
            }
          />
        ) : (
          Array.from(grouped.entries()).map(([cat, list]) => (
            <section key={cat}>
              <SectionTitle
                right={
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {fmtEUR(list.reduce((s, a) => s + a.currentValue * (a.ownershipPct / 100), 0))}
                  </span>
                }
              >
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colors[cat] }} />
                {CATEGORY_LABELS[cat]}
              </SectionTitle>
              <div className="space-y-2">
                {list.map((a, i) => (
                  <AssetRow key={a.id} asset={a} index={i} liabilities={liabilities} onEdit={() => setEditingAsset(a)} />
                ))}
              </div>
            </section>
          ))
        ))}

      {tab === "credits" &&
        (liabilities.length === 0 ? (
          <EmptyState
            title="Aucun crédit enregistré"
            body="Ajoutez vos crédits pour calculer votre patrimoine net, votre taux d'endettement et le coût restant de chaque dette."
            cta={
              <button className="btn-primary" onClick={() => setEditingLiab("new")}>
                Ajouter un crédit
              </button>
            }
          />
        ) : (
          <div className="space-y-2">
            {liabilities.map((l, i) => (
              <LiabilityRow key={l.id} liab={l} index={i} assets={assets} onEdit={() => setEditingLiab(l)} />
            ))}
          </div>
        ))}

      {editingAsset && (
        <AssetForm
          initial={editingAsset === "new" ? null : editingAsset}
          liabilities={liabilities}
          onClose={() => setEditingAsset(null)}
          onSave={(a, loan) => {
            editingAsset === "new" ? addAsset(a) : updateAsset(a);
            const existing = liabilities.find((l) => l.linkedAssetId === a.id);
            if (loan) {
              if (existing) {
                updateLiability({ ...existing, ...loan, updatedAt: new Date().toISOString() });
              } else {
                addLiability({
                  id: uid(),
                  type: "Crédit immobilier",
                  name: `Crédit — ${a.name}`,
                  initialCapital: loan.remainingCapital,
                  remainingCapital: loan.remainingCapital,
                  monthlyPayment: loan.monthlyPayment,
                  insuranceMonthly: 0,
                  ratePct: loan.ratePct,
                  rateType: "fixe",
                  linkedAssetId: a.id,
                  updatedAt: new Date().toISOString(),
                });
              }
            } else if (existing) {
              removeLiability(existing.id);
            }
            setEditingAsset(null);
          }}
          onDelete={
            editingAsset !== "new"
              ? () => {
                  const existing = liabilities.find((l) => l.linkedAssetId === (editingAsset as Asset).id);
                  if (existing) removeLiability(existing.id);
                  removeAsset((editingAsset as Asset).id);
                  setEditingAsset(null);
                }
              : undefined
          }
        />
      )}

      {editingLiab && (
        <LiabilityForm
          initial={editingLiab === "new" ? null : editingLiab}
          assets={assets}
          onClose={() => setEditingLiab(null)}
          onSave={(l) => {
            editingLiab === "new" ? addLiability(l) : updateLiability(l);
            setEditingLiab(null);
          }}
          onDelete={
            editingLiab !== "new"
              ? () => {
                  removeLiability((editingLiab as Liability).id);
                  setEditingLiab(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function AssetRow({
  asset: a,
  liabilities,
  onEdit,
  index = 0,
}: {
  asset: Asset;
  liabilities: Liability[];
  onEdit: () => void;
  index?: number;
}) {
  const loan = liabilities.find((l) => l.id === a.linkedLoanId || l.linkedAssetId === a.id);
  const netValue = a.currentValue * (a.ownershipPct / 100) - (loan?.remainingCapital ?? 0);
  const totalCost = (a.purchasePrice ?? 0) + (a.notaryFees ?? 0) + (a.works ?? 0);
  const costBasis = a.purchasePrice
    ? totalCost
    : a.invested
      ? a.invested
      : a.avgPrice && a.quantity
        ? a.avgPrice * a.quantity
        : null;
  const gain = costBasis !== null ? a.currentValue - costBasis : null;

  // Rendements locatifs
  let yields: { gross: number; net: number; cashflow: number } | null = null;
  if (a.category === "immobilier" && a.monthlyRent && totalCost > 0) {
    const rentEff = a.monthlyRent * (1 - (a.vacancyPct ?? 0) / 100);
    const yearCosts =
      (a.monthlyCharges ?? 0) * 12 +
      (a.propertyTax ?? 0) +
      (a.insuranceYearly ?? 0) +
      ((rentEff * 12 * (a.managementPct ?? 0)) / 100);
    const netYear = rentEff * 12 - yearCosts;
    yields = {
      gross: ((a.monthlyRent * 12) / totalCost) * 100,
      net: (netYear / totalCost) * 100,
      cashflow: netYear / 12 - (loan ? loan.monthlyPayment + loan.insuranceMonthly : 0),
    };
  }

  const market =
    a.category === "immobilier" && a.surface
      ? compareToMarket(a.city, a.postalCode, a.currentValue / a.surface)
      : null;

  return (
    <Card className={`animate-in delay-${Math.min(index, 7) + 1} cursor-pointer`} onClick={onEdit}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold" style={{ color: "var(--text-primary)" }}>
            {a.name}
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {a.subtype}
            {a.city ? ` · ${a.city}` : ""}
            {a.ownershipPct !== 100 ? ` · détenu à ${a.ownershipPct} %` : ""}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-bold" style={{ color: "var(--text-primary)" }}>
            {fmtEUR(a.currentValue * (a.ownershipPct / 100))}
          </div>
          {loan && (
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              net de crédit : {fmtEUR(netValue)}
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {gain !== null && (
          <Badge tone={gain >= 0 ? "good" : "serious"}>
            {gain >= 0 ? "+" : "−"}
            {fmtEUR(Math.abs(gain))} {a.category === "immobilier" ? "de plus-value latente" : ""}
          </Badge>
        )}
        {yields && (
          <>
            <Badge>Brut {fmtPct(yields.gross)}</Badge>
            <Badge>Net {fmtPct(yields.net)}</Badge>
            <Badge tone={yields.cashflow >= 0 ? "good" : "warning"}>
              Cash-flow {yields.cashflow >= 0 ? "+" : "−"}
              {fmtEUR(Math.abs(yields.cashflow))}/mois
            </Badge>
          </>
        )}
        {a.category === "crypto" && a.custody === "plateforme" && (
          <Badge tone="warning">⚠ conservé sur plateforme</Badge>
        )}
        {market && (
          <Badge
            tone={market.gapPct <= -5 ? "good" : market.gapPct <= 10 ? "neutral" : "serious"}
          >
            {market.label}
            {market.precision === "departement" ? " (dép.)" : ""}
          </Badge>
        )}
      </div>
    </Card>
  );
}

function LiabilityRow({
  liab: l,
  assets,
  onEdit,
  index = 0,
}: {
  liab: Liability;
  assets: Asset[];
  onEdit: () => void;
  index?: number;
}) {
  const linked = assets.find((a) => a.id === l.linkedAssetId);
  const ri = remainingInterest(l.remainingCapital, l.monthlyPayment, l.ratePct);
  const paidPct = l.initialCapital > 0 ? ((l.initialCapital - l.remainingCapital) / l.initialCapital) * 100 : 0;
  return (
    <Card className={`animate-in delay-${Math.min(index, 7) + 1} cursor-pointer`} onClick={onEdit}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold" style={{ color: "var(--text-primary)" }}>
            {l.name}
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {l.type} · {fmtPct(l.ratePct)} {l.rateType}
            {linked ? ` · adossé à ${linked.name}` : ""}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-bold" style={{ color: "var(--critical)" }}>
            −{fmtEUR(l.remainingCapital)}
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {fmtEUR(l.monthlyPayment + l.insuranceMonthly)}/mois
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge>{paidPct.toFixed(0)} % remboursé</Badge>
        {Number.isFinite(ri.totalInterest) && (
          <Badge tone={l.ratePct > 4 ? "serious" : "neutral"}>
            ≈ {fmtEUR(ri.totalInterest)} d'intérêts restants
          </Badge>
        )}
        {ri.months > 0 && Number.isFinite(ri.months) && (
          <Badge>fin estimée : {new Date(Date.now() + ri.months * 30.44 * 24 * 3600 * 1000).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}</Badge>
        )}
      </div>
    </Card>
  );
}

interface LoanInput {
  remainingCapital: number;
  monthlyPayment: number;
  ratePct: number;
}

function AssetForm({
  initial,
  liabilities,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Asset | null;
  liabilities: Liability[];
  onClose: () => void;
  onSave: (a: Asset, loan: LoanInput | null) => void;
  onDelete?: () => void;
}) {
  const [a, setA] = useState<Asset>(
    initial ?? {
      id: uid(),
      category: "liquidites",
      subtype: "Compte courant",
      name: "",
      currentValue: 0,
      ownershipPct: 100,
      updatedAt: new Date().toISOString(),
    }
  );
  const existingLoan = initial ? liabilities.find((l) => l.linkedAssetId === initial.id) : undefined;
  const [hasLoan, setHasLoan] = useState(!!existingLoan);
  const [loan, setLoan] = useState<LoanInput>({
    remainingCapital: existingLoan?.remainingCapital ?? 0,
    monthlyPayment: existingLoan?.monthlyPayment ?? 0,
    ratePct: existingLoan?.ratePct ?? 0,
  });
  const [error, setError] = useState("");
  const set = (patch: Partial<Asset>) => setA((prev) => ({ ...prev, ...patch }));
  const setLoanField = (patch: Partial<LoanInput>) => setLoan((prev) => ({ ...prev, ...patch }));

  const market =
    a.category === "immobilier" && a.surface
      ? compareToMarket(a.city, a.postalCode, a.currentValue / a.surface)
      : null;

  const save = () => {
    if (!a.name.trim()) return setError("Donnez un nom à cet actif.");
    if (a.currentValue < 0) return setError("La valeur ne peut pas être négative.");
    if (a.ownershipPct <= 0 || a.ownershipPct > 100)
      return setError("Le pourcentage de détention doit être entre 1 et 100.");
    if (hasLoan && loan.remainingCapital <= 0)
      return setError("Indiquez le montant restant à rembourser sur ce crédit.");
    if (hasLoan && loan.monthlyPayment <= 0) return setError("Indiquez la mensualité du crédit.");
    onSave(
      { ...a, name: a.name.trim(), updatedAt: new Date().toISOString() },
      a.category === "immobilier" && hasLoan ? loan : null
    );
  };

  return (
    <Modal open onClose={onClose} title={initial ? "Modifier l'actif" : "Ajouter un actif"}>
      <div className="space-y-4">
        <Field label="Catégorie">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CATEGORY_LABELS) as AssetCategory[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set({ category: c, subtype: SUBTYPES[c][0] })}
                className="rounded-full px-3 py-1.5 text-xs font-medium"
                style={{
                  background: a.category === c ? "color-mix(in srgb, var(--accent) 15%, transparent)" : "var(--page)",
                  border: `1px solid ${a.category === c ? "var(--accent)" : "var(--border)"}`,
                  color: a.category === c ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className="input" value={a.subtype} onChange={(e) => set({ subtype: e.target.value })}>
              {SUBTYPES[a.category].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Nom">
            <input className="input" value={a.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex : Livret A" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valeur actuelle" hint="Estimation de la valeur de marché.">
            <NumberInput value={a.currentValue} onChange={(v) => set({ currentValue: v })} suffix="€" min={0} />
          </Field>
          <Field label="Détention" hint="100 % si vous êtes seul propriétaire.">
            <NumberInput value={a.ownershipPct} onChange={(v) => set({ ownershipPct: v })} suffix="%" min={1} />
          </Field>
        </div>

        {a.category === "immobilier" && (
          <>
            <Field label="Adresse" hint="Pour placer le bien sur la carte.">
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={a.address ?? ""}
                  onChange={(e) => set({ address: e.target.value, lat: undefined, lng: undefined })}
                  placeholder="Ex : 12 rue de la Liberté"
                />
                <AssetLocateButton asset={a} onLocated={(lat, lng) => set({ lat, lng })} />
              </div>
              {a.lat != null && a.lng != null && (
                <span className="hint" style={{ color: "var(--good-text)" }}>
                  ✓ Localisé — visible sur la carte
                </span>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ville">
                <input className="input" value={a.city ?? ""} onChange={(e) => set({ city: e.target.value })} />
              </Field>
              <Field label="Code postal" hint="Pour comparer au marché local.">
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={5}
                  value={a.postalCode ?? ""}
                  onChange={(e) => set({ postalCode: e.target.value })}
                  placeholder="Ex : 35000"
                />
              </Field>
              <Field label="Surface">
                <NumberInput value={a.surface} onChange={(v) => set({ surface: v })} suffix="m²" min={0} />
              </Field>
              <Field label="Prix d'achat">
                <NumberInput value={a.purchasePrice} onChange={(v) => set({ purchasePrice: v })} suffix="€" min={0} />
              </Field>
              <Field label="Frais de notaire">
                <NumberInput value={a.notaryFees} onChange={(v) => set({ notaryFees: v })} suffix="€" min={0} />
              </Field>
              <Field label="Travaux réalisés">
                <NumberInput value={a.works} onChange={(v) => set({ works: v })} suffix="€" min={0} />
              </Field>
              <Field label="Loyer mensuel" hint="Laissez 0 si non loué.">
                <NumberInput value={a.monthlyRent} onChange={(v) => set({ monthlyRent: v })} suffix="€" min={0} />
              </Field>
            </div>
            {(a.monthlyRent ?? 0) > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Charges mensuelles">
                  <NumberInput value={a.monthlyCharges} onChange={(v) => set({ monthlyCharges: v })} suffix="€" min={0} />
                </Field>
                <Field label="Taxe foncière / an">
                  <NumberInput value={a.propertyTax} onChange={(v) => set({ propertyTax: v })} suffix="€" min={0} />
                </Field>
                <Field label="Assurance / an">
                  <NumberInput value={a.insuranceYearly} onChange={(v) => set({ insuranceYearly: v })} suffix="€" min={0} />
                </Field>
                <Field label="Frais de gestion" hint="% des loyers (0 si gestion directe).">
                  <NumberInput value={a.managementPct} onChange={(v) => set({ managementPct: v })} suffix="%" min={0} />
                </Field>
                <Field label="Vacance estimée" hint="% du temps sans locataire.">
                  <NumberInput value={a.vacancyPct} onChange={(v) => set({ vacancyPct: v })} suffix="%" min={0} />
                </Field>
                <Field label="Régime fiscal">
                  <select className="input" value={a.taxRegime ?? ""} onChange={(e) => set({ taxRegime: e.target.value })}>
                    <option value="">— Choisir —</option>
                    <option>Micro-foncier</option>
                    <option>Foncier réel</option>
                    <option>LMNP micro-BIC</option>
                    <option>LMNP réel</option>
                    <option>SCI IS</option>
                    <option>Autre</option>
                  </select>
                </Field>
              </div>
            )}

            {market && a.surface ? (
              <div
                className="rounded-xl p-3 text-sm"
                style={{ background: "var(--page)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center justify-between">
                  <span style={{ color: "var(--text-secondary)" }}>
                    Comparaison marché — {market.place}
                    {market.precision === "departement" ? " (moy. département)" : ""}
                  </span>
                  <Badge tone={market.gapPct <= -5 ? "good" : market.gapPct <= 10 ? "neutral" : "serious"}>
                    {market.label}
                  </Badge>
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  Votre estimation : {fmtEUR(market.yourPricePerSqm)}/m² · Marché : {fmtEUR(market.refPricePerSqm)}/m²
                  {" "}(écart {market.gapPct >= 0 ? "+" : ""}{fmtPct(market.gapPct, 0)}). Estimation indicative, à
                  vérifier via DVF ou une agence locale.
                </p>
              </div>
            ) : a.city ? (
              <p className="hint">
                Renseignez la surface et le code postal pour comparer ce bien au prix du marché local.
              </p>
            ) : null}

            <div className="rounded-xl p-3" style={{ background: "var(--page)", border: "1px solid var(--border)" }}>
              <label className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                <input type="checkbox" checked={hasLoan} onChange={(e) => setHasLoan(e.target.checked)} />
                Crédit en cours sur ce bien
              </label>
              {hasLoan && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Montant restant à rembourser">
                    <NumberInput
                      value={loan.remainingCapital}
                      onChange={(v) => setLoanField({ remainingCapital: v })}
                      suffix="€"
                      min={0}
                    />
                  </Field>
                  <Field label="Mensualité (hors assurance)">
                    <NumberInput
                      value={loan.monthlyPayment}
                      onChange={(v) => setLoanField({ monthlyPayment: v })}
                      suffix="€"
                      min={0}
                    />
                  </Field>
                  <Field label="Taux nominal" hint="Pour affiner le calcul, modifiable ensuite dans Crédits.">
                    <NumberInput value={loan.ratePct} onChange={(v) => setLoanField({ ratePct: v })} suffix="%" min={0} step={0.05} />
                  </Field>
                  <div className="flex flex-col justify-end">
                    <span className="label">Valeur nette du bien</span>
                    <span className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>
                      {fmtEUR(a.currentValue * (a.ownershipPct / 100) - loan.remainingCapital)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {a.category === "liquidites" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Établissement">
              <input className="input" value={a.bank ?? ""} onChange={(e) => set({ bank: e.target.value })} />
            </Field>
            <Field label="Taux" hint="0 pour un compte courant.">
              <NumberInput value={a.ratePct} onChange={(v) => set({ ratePct: v })} suffix="%" min={0} step={0.1} />
            </Field>
          </div>
        )}

        {a.category === "financier" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Enveloppe">
              <select className="input" value={a.envelope ?? ""} onChange={(e) => set({ envelope: e.target.value })}>
                <option value="">— Choisir —</option>
                <option>PEA</option>
                <option>Compte-titres</option>
                <option>Assurance-vie</option>
                <option>PER</option>
                <option>Autre</option>
              </select>
            </Field>
            <Field label="Montant investi" hint="Total de vos versements (prix de revient).">
              <NumberInput value={a.invested} onChange={(v) => set({ invested: v })} suffix="€" min={0} />
            </Field>
            <Field label="Versement mensuel">
              <NumberInput value={a.monthlyContribution} onChange={(v) => set({ monthlyContribution: v })} suffix="€" min={0} />
            </Field>
            <Field label="Niveau de risque">
              <select
                className="input"
                value={a.riskLevel ?? ""}
                onChange={(e) => set({ riskLevel: (e.target.value || undefined) as Asset["riskLevel"] })}
              >
                <option value="">— Choisir —</option>
                <option value="faible">Faible (fonds euros…)</option>
                <option value="modéré">Modéré (mixte)</option>
                <option value="élevé">Élevé (actions, ETF…)</option>
              </select>
            </Field>
          </div>
        )}

        {a.category === "crypto" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Plateforme / portefeuille">
              <input className="input" value={a.platform ?? ""} onChange={(e) => set({ platform: e.target.value })} />
            </Field>
            <Field label="Conservation">
              <select
                className="input"
                value={a.custody ?? ""}
                onChange={(e) => set({ custody: (e.target.value || undefined) as Asset["custody"] })}
              >
                <option value="">— Choisir —</option>
                <option value="plateforme">Plateforme centralisée</option>
                <option value="portefeuille personnel">Portefeuille personnel</option>
              </select>
            </Field>
            <Field label="Quantité">
              <NumberInput value={a.quantity} onChange={(v) => set({ quantity: v })} min={0} step={0.0001} />
            </Field>
            <Field label="Prix moyen d'achat">
              <NumberInput value={a.avgPrice} onChange={(v) => set({ avgPrice: v })} suffix="€" min={0} />
            </Field>
          </div>
        )}

        {a.category === "societe" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Chiffre d'affaires / an">
              <NumberInput value={a.revenue} onChange={(v) => set({ revenue: v })} suffix="€" min={0} />
            </Field>
            <Field label="Résultat / an">
              <NumberInput value={a.profit} onChange={(v) => set({ profit: v })} suffix="€" />
            </Field>
          </div>
        )}

        {error && (
          <p className="text-sm font-medium" style={{ color: "var(--critical)" }}>
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          {onDelete && (
            <button
              className="btn-ghost"
              style={{ color: "var(--critical)" }}
              onClick={() => {
                if (confirm("Supprimer cet actif ?")) onDelete();
              }}
            >
              Supprimer
            </button>
          )}
          <button className="btn-primary flex-1" onClick={save}>
            Enregistrer
          </button>
        </div>
      </div>
    </Modal>
  );
}

function LiabilityForm({
  initial,
  assets,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Liability | null;
  assets: Asset[];
  onClose: () => void;
  onSave: (l: Liability) => void;
  onDelete?: () => void;
}) {
  const [l, setL] = useState<Liability>(
    initial ?? {
      id: uid(),
      type: "Crédit immobilier",
      name: "",
      initialCapital: 0,
      remainingCapital: 0,
      monthlyPayment: 0,
      insuranceMonthly: 0,
      ratePct: 0,
      rateType: "fixe",
      updatedAt: new Date().toISOString(),
    }
  );
  const [error, setError] = useState("");
  const set = (patch: Partial<Liability>) => setL((prev) => ({ ...prev, ...patch }));

  const ri = remainingInterest(l.remainingCapital, l.monthlyPayment, l.ratePct);

  const save = () => {
    if (!l.name.trim()) return setError("Donnez un nom à ce crédit.");
    if (l.remainingCapital <= 0) return setError("Indiquez le capital restant dû.");
    if (l.monthlyPayment <= 0) return setError("Indiquez la mensualité.");
    onSave({ ...l, name: l.name.trim(), updatedAt: new Date().toISOString() });
  };

  return (
    <Modal open onClose={onClose} title={initial ? "Modifier le crédit" : "Ajouter un crédit"}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className="input" value={l.type} onChange={(e) => set({ type: e.target.value as LiabilityType })}>
              {LIABILITY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Nom">
            <input className="input" value={l.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex : Prêt maison" />
          </Field>
          <Field label="Capital initial">
            <NumberInput value={l.initialCapital} onChange={(v) => set({ initialCapital: v })} suffix="€" min={0} />
          </Field>
          <Field label="Capital restant dû">
            <NumberInput value={l.remainingCapital} onChange={(v) => set({ remainingCapital: v })} suffix="€" min={0} />
          </Field>
          <Field label="Mensualité (hors assurance)">
            <NumberInput value={l.monthlyPayment} onChange={(v) => set({ monthlyPayment: v })} suffix="€" min={0} />
          </Field>
          <Field label="Assurance / mois">
            <NumberInput value={l.insuranceMonthly} onChange={(v) => set({ insuranceMonthly: v })} suffix="€" min={0} />
          </Field>
          <Field label="Taux nominal">
            <NumberInput value={l.ratePct} onChange={(v) => set({ ratePct: v })} suffix="%" min={0} step={0.05} />
          </Field>
          <Field label="Type de taux">
            <select className="input" value={l.rateType} onChange={(e) => set({ rateType: e.target.value as "fixe" | "variable" })}>
              <option value="fixe">Fixe</option>
              <option value="variable">Variable</option>
            </select>
          </Field>
        </div>
        <Field label="Actif financé (facultatif)" hint="Relie ce crédit à un bien pour calculer sa valeur nette.">
          <select className="input" value={l.linkedAssetId ?? ""} onChange={(e) => set({ linkedAssetId: e.target.value || undefined })}>
            <option value="">— Aucun —</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>

        {l.remainingCapital > 0 && l.monthlyPayment > 0 && (
          <div className="rounded-xl p-3 text-sm" style={{ background: "var(--page)", color: "var(--text-secondary)" }}>
            {Number.isFinite(ri.totalInterest) ? (
              <>
                Coût restant estimé : <strong style={{ color: "var(--text-primary)" }}>{fmtEUR(ri.totalInterest)}</strong> d'intérêts
                sur ≈ {Math.round(ri.months / 12)} ans.
                <CalcDetail
                  lines={[
                    "Nombre de mois n = −ln(1 − CRD × t/12 ÷ M) ÷ ln(1 + t/12)",
                    "Intérêts restants = n × M − CRD",
                    `Avec CRD = ${fmtEUR(l.remainingCapital)}, M = ${fmtEUR(l.monthlyPayment)}, t = ${l.ratePct} %`,
                  ]}
                />
              </>
            ) : (
              <span style={{ color: "var(--critical)" }}>
                ⚠ La mensualité ne couvre pas les intérêts : ce crédit ne sera jamais remboursé à ce rythme.
              </span>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm font-medium" style={{ color: "var(--critical)" }}>
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          {onDelete && (
            <button
              className="btn-ghost"
              style={{ color: "var(--critical)" }}
              onClick={() => {
                if (confirm("Supprimer ce crédit ?")) onDelete();
              }}
            >
              Supprimer
            </button>
          )}
          <button className="btn-primary flex-1" onClick={save}>
            Enregistrer
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AssetLocateButton({
  asset,
  onLocated,
}: {
  asset: Asset;
  onLocated: (lat: number, lng: number) => void;
}) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const run = async () => {
    const query = [asset.address, asset.city, "France"].filter(Boolean).join(", ");
    if (!asset.address?.trim() && !asset.city?.trim()) {
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
