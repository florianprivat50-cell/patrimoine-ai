import { useState } from "react";
import { Card, Field, NumberInput, PageHeader, SectionTitle } from "../components/ui";
import { IconDownload, IconSparkles } from "../components/icons";
import { useStore } from "../store";

type Theme = "system" | "light" | "dark";

function applyTheme(t: Theme) {
  if (t === "system") {
    localStorage.removeItem("pia-theme");
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } else {
    localStorage.setItem("pia-theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }
}

export default function Profil() {
  const { profile, updateProfile, demoMode, enterDemo, exitDemo, resetAll } = useStore();
  const [theme, setTheme] = useState<Theme>(
    (localStorage.getItem("pia-theme") as Theme | null) ?? "system"
  );
  const [saved, setSaved] = useState(false);

  const exportData = () => {
    const state = useStore.getState();
    const data = {
      exportedAt: new Date().toISOString(),
      demoMode: state.demoMode,
      profile: state.profile,
      assets: state.assets,
      liabilities: state.liabilities,
      goals: state.goals,
      projects: state.projects,
      snapshots: state.snapshots,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `patrimoine-ia-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const flash = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Profil & paramètres" />

      <Card>
        <SectionTitle right={saved ? <span className="text-xs" style={{ color: "var(--good-text)" }}>✓ Enregistré</span> : undefined}>
          Situation
        </SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom">
            <input
              className="input"
              value={profile?.firstName ?? ""}
              onChange={(e) => {
                updateProfile({ firstName: e.target.value });
                flash();
              }}
            />
          </Field>
          <Field label="Âge">
            <NumberInput value={profile?.age} onChange={(v) => { updateProfile({ age: v }); flash(); }} suffix="ans" />
          </Field>
          <Field label="Revenus nets / mois">
            <NumberInput
              value={profile?.netMonthlyIncome}
              onChange={(v) => { updateProfile({ netMonthlyIncome: v }); flash(); }}
              suffix="€"
            />
          </Field>
          <Field label="Revenus conjoint / mois">
            <NumberInput
              value={profile?.partnerMonthlyIncome}
              onChange={(v) => { updateProfile({ partnerMonthlyIncome: v }); flash(); }}
              suffix="€"
            />
          </Field>
          <Field label="Épargne mensuelle">
            <NumberInput
              value={profile?.monthlySavings}
              onChange={(v) => { updateProfile({ monthlySavings: v }); flash(); }}
              suffix="€"
            />
          </Field>
          <Field label="Dépenses mensuelles">
            <NumberInput
              value={profile?.monthlyExpenses}
              onChange={(v) => { updateProfile({ monthlyExpenses: v }); flash(); }}
              suffix="€"
            />
          </Field>
          <Field label="Tolérance au risque">
            <select
              className="input"
              value={profile?.riskTolerance ?? ""}
              onChange={(e) => { updateProfile({ riskTolerance: (e.target.value || undefined) as any }); flash(); }}
            >
              <option value="">— Choisir —</option>
              <option value="prudent">Prudent</option>
              <option value="équilibré">Équilibré</option>
              <option value="dynamique">Dynamique</option>
            </select>
          </Field>
          <Field label="Horizon">
            <NumberInput value={profile?.horizonYears} onChange={(v) => { updateProfile({ horizonYears: v }); flash(); }} suffix="ans" />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle>Apparence</SectionTitle>
        <div className="flex gap-2">
          {(
            [
              ["system", "Auto (système)"],
              ["light", "Clair"],
              ["dark", "Sombre"],
            ] as [Theme, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => {
                setTheme(t);
                applyTheme(t);
              }}
              className="flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition"
              style={{
                background: theme === t ? "var(--accent)" : "var(--surface-1)",
                color: theme === t ? "#fff" : "var(--text-secondary)",
                border: `1px solid ${theme === t ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Données</SectionTitle>
        <div className="space-y-3">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Vos données sont stockées <strong>uniquement sur cet appareil</strong> (stockage local du
            navigateur). Aucune donnée n'est envoyée sur un serveur.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost flex items-center gap-1.5" onClick={exportData}>
              <IconDownload size={15} /> Exporter mes données (JSON)
            </button>
            {demoMode ? (
              <button className="btn-ghost" onClick={exitDemo}>
                Quitter le mode démo
              </button>
            ) : (
              <button className="btn-ghost flex items-center gap-1.5" onClick={enterDemo}>
                <IconSparkles size={15} /> Voir le compte de démonstration
              </button>
            )}
            <button
              className="btn-ghost"
              style={{ color: "var(--critical)" }}
              onClick={() => {
                if (
                  confirm(
                    "Supprimer définitivement toutes vos données locales (profil, actifs, crédits, objectifs, projets) ? Cette action est irréversible."
                  )
                )
                  resetAll();
              }}
            >
              Supprimer toutes mes données
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>À propos</SectionTitle>
        <div className="space-y-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          <p>
            <strong style={{ color: "var(--text-primary)" }}>Patrimoine IA</strong> — version MVP.
            Application d'aide à la décision patrimoniale : centralisation du patrimoine, indicateurs,
            calculateur immobilier à trois scénarios, objectifs et analyse à base de règles.
          </p>
          <p>
            Tous les calculs sont transparents : chaque résultat propose un panneau « Détail du
            calcul » avec les formules et hypothèses utilisées, que vous pouvez modifier.
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Cette application fournit des outils d'aide à la décision et ne remplace pas un
            conseiller financier, fiscal, juridique ou immobilier. Aucun rendement n'est garanti ;
            les projections sont des hypothèses, pas des promesses.
          </p>
        </div>
      </Card>
    </div>
  );
}
