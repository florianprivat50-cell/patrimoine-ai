import { useState } from "react";
import { Field, NumberInput, ProgressBar } from "../components/ui";
import { useStore } from "../store";
import { Profile } from "../types";

const OBJECTIVES = [
  "Acheter une résidence principale",
  "Investir dans l'immobilier",
  "Préparer la retraite",
  "Générer des revenus passifs",
  "Protéger ma famille",
  "Réduire mon endettement",
  "Investir en bourse",
  "Développer mon patrimoine",
  "Atteindre l'indépendance financière",
  "Transmettre un patrimoine",
  "Créer une société",
  "Financer un projet personnel",
];

export default function Onboarding() {
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const enterDemo = useStore((s) => s.enterDemo);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [p, setP] = useState<Partial<Profile>>({
    objectives: [],
    netMonthlyIncome: 0,
    partnerMonthlyIncome: 0,
    monthlySavings: 0,
  });

  const set = (patch: Partial<Profile>) => setP((prev) => ({ ...prev, ...patch }));

  const next = () => {
    setError("");
    if (step === 0) {
      if (!p.firstName?.trim()) return setError("Indiquez au moins votre prénom.");
      if (!p.netMonthlyIncome || p.netMonthlyIncome <= 0)
        return setError("Indiquez vos revenus nets mensuels (même approximatifs).");
    }
    if (step === 3) {
      completeOnboarding({
        firstName: p.firstName!.trim(),
        age: p.age,
        familyStatus: p.familyStatus,
        children: p.children,
        country: p.country ?? "France",
        jobStatus: p.jobStatus,
        netMonthlyIncome: p.netMonthlyIncome ?? 0,
        partnerMonthlyIncome: p.partnerMonthlyIncome ?? 0,
        incomeStability: p.incomeStability,
        monthlySavings: p.monthlySavings ?? 0,
        monthlyExpenses: p.monthlyExpenses,
        knowledgeLevel: p.knowledgeLevel,
        objectives: p.objectives ?? [],
        riskTolerance: p.riskTolerance,
        horizonYears: p.horizonYears,
      });
      return;
    }
    setStep(step + 1);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      <div className="mb-6 flex items-center gap-3">
        <img src="/icon.svg" alt="" className="h-10 w-10 rounded-xl" />
        <div>
          <h1 className="font-display text-[22px]" style={{ color: "var(--text-primary)" }}>
            Patrimoine IA
          </h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Votre copilote patrimonial
          </p>
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-1 flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
          <span>Étape {step + 1} / 4</span>
          <span>
            {["Situation", "Objectifs", "Patrimoine", "Profil de risque"][step]}
          </span>
        </div>
        <ProgressBar pct={((step + 1) / 4) * 100} />
      </div>

      <div className="flex-1 space-y-4">
        {step === 0 && (
          <>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Quelques informations pour personnaliser l'analyse. Vous pourrez tout compléter ou
              modifier plus tard.
            </p>
            <Field label="Prénom">
              <input
                className="input"
                value={p.firstName ?? ""}
                onChange={(e) => set({ firstName: e.target.value })}
                placeholder="Camille"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Âge">
                <NumberInput value={p.age} onChange={(v) => set({ age: v })} suffix="ans" min={16} />
              </Field>
              <Field label="Enfants">
                <NumberInput value={p.children} onChange={(v) => set({ children: v })} min={0} />
              </Field>
            </div>
            <Field label="Situation familiale">
              <select
                className="input"
                value={p.familyStatus ?? ""}
                onChange={(e) => set({ familyStatus: e.target.value })}
              >
                <option value="">— Choisir —</option>
                <option>Célibataire</option>
                <option>En couple</option>
                <option>Marié·e / pacsé·e</option>
                <option>Divorcé·e</option>
                <option>Veuf·ve</option>
              </select>
            </Field>
            <Field label="Statut professionnel">
              <select
                className="input"
                value={p.jobStatus ?? ""}
                onChange={(e) => set({ jobStatus: e.target.value })}
              >
                <option value="">— Choisir —</option>
                <option>Salarié·e en CDI</option>
                <option>Salarié·e en CDD / intérim</option>
                <option>Indépendant·e / freelance</option>
                <option>Chef·fe d'entreprise</option>
                <option>Fonctionnaire</option>
                <option>Retraité·e</option>
                <option>Sans activité</option>
              </select>
            </Field>
            <Field label="Revenus nets mensuels" hint="Après impôt à la source, hors revenus locatifs.">
              <NumberInput
                value={p.netMonthlyIncome}
                onChange={(v) => set({ netMonthlyIncome: v })}
                suffix="€"
                min={0}
              />
            </Field>
            <Field label="Revenus du conjoint (facultatif)">
              <NumberInput
                value={p.partnerMonthlyIncome}
                onChange={(v) => set({ partnerMonthlyIncome: v })}
                suffix="€"
                min={0}
              />
            </Field>
            <Field
              label="Capacité d'épargne mensuelle"
              hint="Ce que vous mettez de côté un mois normal."
            >
              <NumberInput
                value={p.monthlySavings}
                onChange={(v) => set({ monthlySavings: v })}
                suffix="€"
                min={0}
              />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Quels sont vos objectifs ? (plusieurs choix possibles)
            </p>
            <div className="flex flex-wrap gap-2">
              {OBJECTIVES.map((o) => {
                const sel = p.objectives?.includes(o);
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() =>
                      set({
                        objectives: sel
                          ? p.objectives!.filter((x) => x !== o)
                          : [...(p.objectives ?? []), o],
                      })
                    }
                    className="rounded-full px-3.5 py-2 text-[13px] font-medium transition"
                    style={{
                      background: sel
                        ? "color-mix(in srgb, var(--accent) 15%, transparent)"
                        : "var(--surface-1)",
                      border: `1px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                      color: sel ? "var(--accent)" : "var(--text-secondary)",
                    }}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Vous ajouterez vos comptes, biens et crédits juste après, depuis l'onglet{" "}
              <strong>Patrimoine</strong> — en quelques secondes par élément. Pour situer votre
              point de départ :
            </p>
            <Field label="Dépenses mensuelles du foyer (facultatif)" hint="Sert au calcul de l'épargne de sécurité.">
              <NumberInput
                value={p.monthlyExpenses}
                onChange={(v) => set({ monthlyExpenses: v })}
                suffix="€"
                min={0}
              />
            </Field>
            <Field label="Niveau de connaissance financière">
              <select
                className="input"
                value={p.knowledgeLevel ?? ""}
                onChange={(e) => set({ knowledgeLevel: e.target.value as Profile["knowledgeLevel"] })}
              >
                <option value="">— Choisir —</option>
                <option value="débutant">Débutant</option>
                <option value="intermédiaire">Intermédiaire</option>
                <option value="avancé">Avancé</option>
              </select>
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Dernière étape : votre rapport au risque.
            </p>
            <Field label="Tolérance aux pertes">
              <div className="grid gap-2">
                {(
                  [
                    ["prudent", "Prudent — je veux avant tout protéger mon capital"],
                    ["équilibré", "Équilibré — j'accepte des variations modérées"],
                    ["dynamique", "Dynamique — j'accepte de fortes variations pour viser plus haut"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set({ riskTolerance: v })}
                    className="rounded-xl px-4 py-3 text-left text-sm font-medium transition"
                    style={{
                      background:
                        p.riskTolerance === v
                          ? "color-mix(in srgb, var(--accent) 15%, transparent)"
                          : "var(--surface-1)",
                      border: `1px solid ${p.riskTolerance === v ? "var(--accent)" : "var(--border)"}`,
                      color: p.riskTolerance === v ? "var(--accent)" : "var(--text-secondary)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Horizon d'investissement" hint="Durée avant d'avoir besoin de cet argent.">
              <NumberInput
                value={p.horizonYears}
                onChange={(v) => set({ horizonYears: v })}
                suffix="ans"
                min={1}
              />
            </Field>
          </>
        )}

        {error && (
          <p className="text-sm font-medium" style={{ color: "var(--critical)" }}>
            {error}
          </p>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        {step > 0 && (
          <button className="btn-ghost flex-1" onClick={() => setStep(step - 1)}>
            Retour
          </button>
        )}
        <button className="btn-primary flex-1" onClick={next}>
          {step === 3 ? "Voir mon diagnostic" : "Continuer"}
        </button>
      </div>

      <button
        className="mt-4 text-center text-xs underline-offset-2 hover:underline"
        style={{ color: "var(--text-muted)" }}
        onClick={enterDemo}
      >
        Ou explorer avec un compte de démonstration (données fictives)
      </button>

      <p className="mt-6 text-center text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Patrimoine IA fournit des outils d'aide à la décision et ne remplace pas un conseiller
        financier, fiscal, juridique ou immobilier. Vos données restent stockées localement sur cet
        appareil.
      </p>
    </div>
  );
}
