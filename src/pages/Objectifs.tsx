import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { Badge, CalcDetail, Card, EmptyState, Field, Modal, NumberInput, PageHeader, ProgressBar } from "../components/ui";
import { IconPlus } from "../components/icons";
import { fmtEUR, monthsToTarget } from "../lib/finance";
import { goalProbability } from "../lib/metrics";
import { useStore, uid } from "../store";
import { Goal } from "../types";

/** Trajectoire projetée mois par mois (même formule que goalProbability), échantillonnée
 * pour le graphique — jusqu'à 24 points quel que soit l'horizon. */
function buildTrajectory(g: Goal): { label: string; value: number }[] {
  const totalMonths = Math.max(
    1,
    Math.round((new Date(g.targetDate).getTime() - Date.now()) / (30.44 * 24 * 3600 * 1000))
  );
  const r = g.expectedReturnPct / 100 / 12;
  const step = Math.max(1, Math.round(totalMonths / 24));
  const longHorizon = totalMonths > 30;
  const now = new Date();
  const data: { label: string; value: number }[] = [];
  let v = g.currentAmount;
  for (let m = 0; m <= totalMonths; m++) {
    if (m > 0) v = v * (1 + r) + g.monthlyContribution;
    if (m % step === 0 || m === totalMonths) {
      const d = new Date(now.getFullYear(), now.getMonth() + m, 1);
      data.push({
        label: d.toLocaleDateString("fr-FR", longHorizon ? { year: "numeric" } : { month: "short", year: "2-digit" }),
        value: Math.round(v),
      });
    }
  }
  return data;
}

const TEMPLATES = [
  { name: "Atteindre 100 000 € de patrimoine net", target: 100000 },
  { name: "Constituer un apport de 30 000 €", target: 30000 },
  { name: "6 mois de dépenses d'avance", target: 15000 },
  { name: "1 000 € de revenus passifs / mois", target: 300000 },
  { name: "Atteindre 1 M€ de patrimoine", target: 1000000 },
];

export default function Objectifs() {
  const { goals, addGoal, updateGoal, removeGoal } = useStore();
  const [editing, setEditing] = useState<Goal | "new" | null>(null);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Objectifs"
        subtitle="Fixez un cap, suivez la trajectoire"
        actions={
          <button className="btn-primary flex items-center gap-1.5 !py-2 text-sm" onClick={() => setEditing("new")}>
            <IconPlus size={16} strokeWidth={2.2} /> Objectif
          </button>
        }
      />

      {goals.length === 0 ? (
        <EmptyState
          title="Aucun objectif défini"
          body="Un objectif chiffré et daté transforme une intention en plan : apport, épargne de sécurité, indépendance financière…"
          cta={
            <button className="btn-primary" onClick={() => setEditing("new")}>
              Créer un objectif
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {goals.map((g, i) => (
            <GoalCard key={g.id} goal={g} index={i} onEdit={() => setEditing(g)} />
          ))}
        </div>
      )}

      {editing && (
        <GoalForm
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(g) => {
            editing === "new" ? addGoal(g) : updateGoal(g);
            setEditing(null);
          }}
          onDelete={
            editing !== "new"
              ? () => {
                  removeGoal((editing as Goal).id);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function GoalCard({ goal: g, onEdit, index = 0 }: { goal: Goal; onEdit: () => void; index?: number }) {
  const pct = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;
  const prob = goalProbability(g);
  const trajectory = useMemo(() => buildTrajectory(g), [g]);
  const gradientId = `goalFill-${g.id}`;
  const months = monthsToTarget(g.currentAmount, g.targetAmount, g.monthlyContribution, g.expectedReturnPct);
  const eta =
    months === null
      ? null
      : new Date(Date.now() + months * 30.44 * 24 * 3600 * 1000).toLocaleDateString("fr-FR", {
          month: "long",
          year: "numeric",
        });
  const targetDate = new Date(g.targetDate).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <Card className={`animate-in delay-${Math.min(index, 7) + 1}`} onClick={onEdit}>
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
          {g.name}
        </div>
        <Badge tone={prob.probability === "élevée" ? "good" : prob.probability === "moyenne" ? "warning" : "serious"}>
          Probabilité {prob.probability}
        </Badge>
      </div>
      <div className="mt-3 flex items-baseline justify-between text-sm">
        <span className="font-bold" style={{ color: "var(--text-primary)" }}>
          {fmtEUR(g.currentAmount)}
        </span>
        <span style={{ color: "var(--text-muted)" }}>{fmtEUR(g.targetAmount)}</span>
      </div>
      <div className="mt-1.5">
        <ProgressBar pct={pct} color={prob.onTrack ? "var(--good)" : undefined} delay={index * 60} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        <span>{pct.toFixed(0)} % atteint</span>
        <span>{fmtEUR(g.monthlyContribution)}/mois</span>
        <span>échéance : {targetDate}</span>
        {eta && <span>{prob.onTrack ? "✓ en avance — " : "atteint vers "}{eta}</span>}
      </div>
      <div className="-mx-1 mt-2 h-28" onClick={(e) => e.stopPropagation()}>
        <ResponsiveContainer>
          <AreaChart data={trajectory} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={prob.onTrack ? "var(--good)" : "var(--accent)"} stopOpacity={0.32} />
                <stop offset="100%" stopColor={prob.onTrack ? "var(--good)" : "var(--accent)"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={30} tick={{ fontSize: 10 }} />
            <ReferenceLine
              y={g.targetAmount}
              stroke="var(--baseline)"
              strokeDasharray="4 3"
              label={{ value: "Objectif", position: "insideTopRight", fontSize: 10, fill: "var(--text-muted)" }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                color: "var(--text-primary)",
                fontSize: 12,
              }}
              formatter={(v) => [fmtEUR(Number(v)), "Projection"]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={prob.onTrack ? "var(--good)" : "var(--accent)"}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              animationDuration={900}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <CalcDetail
        lines={[
          `Projection : capital × (1 + ${g.expectedReturnPct} %/12) chaque mois + versement de ${fmtEUR(g.monthlyContribution)}`,
          `À l'échéance (${targetDate}) : ≈ ${fmtEUR(prob.projected)} projetés pour ${fmtEUR(g.targetAmount)} visés`,
          `Le rendement de ${g.expectedReturnPct} %/an est une hypothèse modifiable, pas une promesse.`,
        ]}
      />
    </Card>
  );
}

function GoalForm({
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Goal | null;
  onClose: () => void;
  onSave: (g: Goal) => void;
  onDelete?: () => void;
}) {
  const [g, setG] = useState<Goal>(
    initial ?? {
      id: uid(),
      name: "",
      targetAmount: 0,
      currentAmount: 0,
      monthlyContribution: 0,
      targetDate: new Date(Date.now() + 5 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      expectedReturnPct: 3,
      createdAt: new Date().toISOString(),
    }
  );
  const [error, setError] = useState("");
  const set = (patch: Partial<Goal>) => setG((prev) => ({ ...prev, ...patch }));

  const save = () => {
    if (!g.name.trim()) return setError("Donnez un nom à l'objectif.");
    if (g.targetAmount <= 0) return setError("Indiquez un montant cible.");
    if (!g.targetDate) return setError("Indiquez une date cible.");
    onSave({ ...g, name: g.name.trim() });
  };

  return (
    <Modal open onClose={onClose} title={initial ? "Modifier l'objectif" : "Nouvel objectif"}>
      <div className="space-y-4">
        {!initial && (
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map((t) => (
              <button
                key={t.name}
                type="button"
                className="rounded-full px-3 py-1.5 text-xs"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                onClick={() => set({ name: t.name, targetAmount: t.target })}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
        <Field label="Nom">
          <input className="input" value={g.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex : Apport résidence principale" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant cible">
            <NumberInput value={g.targetAmount} onChange={(v) => set({ targetAmount: v })} suffix="€" min={0} />
          </Field>
          <Field label="Déjà atteint">
            <NumberInput value={g.currentAmount} onChange={(v) => set({ currentAmount: v })} suffix="€" min={0} />
          </Field>
          <Field label="Versement mensuel">
            <NumberInput value={g.monthlyContribution} onChange={(v) => set({ monthlyContribution: v })} suffix="€" min={0} />
          </Field>
          <Field label="Rendement supposé" hint="Hypothèse annuelle, pas une garantie.">
            <NumberInput value={g.expectedReturnPct} onChange={(v) => set({ expectedReturnPct: v })} suffix="%" step={0.5} />
          </Field>
        </div>
        <Field label="Date cible">
          <input
            type="date"
            className="input"
            value={g.targetDate.slice(0, 10)}
            onChange={(e) => set({ targetDate: e.target.value })}
          />
        </Field>

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
                if (confirm("Supprimer cet objectif ?")) onDelete();
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
