import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge, Card, InfoTip, SectionTitle, Stat } from "../components/ui";
import {
  IconAlertTriangle,
  IconBuilding,
  IconCheckCircle,
  IconInfo,
  IconLayers,
  IconPin,
  IconShield,
  IconTrendingUp,
  IconWallet,
} from "../components/icons";
import { useCountUp } from "../hooks/useCountUp";
import { fmtEUR, fmtPct } from "../lib/finance";
import { computeMetrics, computePriority } from "../lib/metrics";
import { useStore } from "../store";
import { CATEGORY_COLORS_DARK, CATEGORY_COLORS_LIGHT, CATEGORY_LABELS } from "../types";

function useIsDark() {
  return document.documentElement.classList.contains("dark");
}

const tooltipStyle = {
  background: "var(--surface-1)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--text-primary)",
  fontSize: 12,
};

export default function Dashboard() {
  const { profile, assets, liabilities, snapshots, recordSnapshot, demoMode } = useStore();
  const isDark = useIsDark();
  const colors = isDark ? CATEGORY_COLORS_DARK : CATEGORY_COLORS_LIGHT;

  const m = useMemo(() => computeMetrics(assets, liabilities, profile), [assets, liabilities, profile]);
  const priority = useMemo(() => computePriority(m, profile), [m, profile]);

  // Enregistre un point d'historique (1 par jour max, jamais en mode démo)
  useEffect(() => {
    recordSnapshot(m.netWorth, m.grossAssets, m.totalDebts);
  }, [m.netWorth]);

  const evolution = useMemo(() => {
    const base = snapshots.map((s) => ({
      date: s.date,
      label: new Date(s.date).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
      netWorth: s.netWorth,
    }));
    return base.length >= 2 ? base : null;
  }, [snapshots]);

  const monthDelta = useMemo(() => {
    if (!snapshots.length) return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 31);
    const ref = snapshots.find((s) => new Date(s.date) >= cutoff) ?? snapshots[0];
    return m.netWorth - ref.netWorth;
  }, [snapshots, m.netWorth]);

  const yearDelta = useMemo(() => {
    if (!snapshots.length) return null;
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const ref = snapshots.find((s) => new Date(s.date) >= cutoff) ?? snapshots[0];
    return m.netWorth - ref.netWorth;
  }, [snapshots, m.netWorth]);

  const sinceStart = snapshots.length ? m.netWorth - snapshots[0].netWorth : null;

  const donutData = m.allocation.map((a) => ({
    name: CATEGORY_LABELS[a.category],
    value: a.value,
    pct: a.pct,
    color: colors[a.category],
  }));

  const sevTone =
    priority.severity === "good" ? "good" : priority.severity === "warning" ? "warning" : "serious";
  const animatedNetWorth = useCountUp(m.netWorth, 900);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[28px] tracking-tight" style={{ color: "var(--text-primary)" }}>
            Bonjour {profile?.firstName ?? ""}
          </h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        {demoMode && <Badge tone="accent">Données fictives</Badge>}
      </header>

      {/* Patrimoine net — le chiffre héros */}
      <div className="hero-card animate-in">
        <div className="hero-glow" aria-hidden />
        <div className="hero-glow-soft" aria-hidden />
        <div className="relative flex items-center gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Patrimoine net
          <InfoTip text="Patrimoine net = total des actifs − total des dettes. C'est ce que vous possédez réellement." />
        </div>
        <div className="figure-gradient relative mt-1 font-display text-[42px] leading-none tracking-tight tabular-nums sm:text-5xl">
          {fmtEUR(animatedNetWorth)}
        </div>
        <div className="relative mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span style={{ color: "var(--text-secondary)" }}>
            Brut <strong style={{ color: "var(--text-primary)" }}>{fmtEUR(m.grossAssets)}</strong>
          </span>
          <span style={{ color: "var(--text-secondary)" }}>
            Dettes <strong style={{ color: "var(--text-primary)" }}>−{fmtEUR(m.totalDebts)}</strong>
          </span>
        </div>
        <div className="relative mt-3 flex flex-wrap gap-2">
          {monthDelta !== null && (
            <Badge tone={monthDelta >= 0 ? "good" : "serious"}>
              {monthDelta >= 0 ? "↑" : "↓"} {fmtEUR(Math.abs(monthDelta))} sur 1 mois
            </Badge>
          )}
          {yearDelta !== null && yearDelta !== monthDelta && (
            <Badge tone={yearDelta >= 0 ? "good" : "serious"}>
              {yearDelta >= 0 ? "↑" : "↓"} {fmtEUR(Math.abs(yearDelta))} sur 1 an
            </Badge>
          )}
          {sinceStart !== null && sinceStart !== yearDelta && sinceStart !== monthDelta && (
            <Badge tone="neutral">
              {sinceStart >= 0 ? "+" : "−"}
              {fmtEUR(Math.abs(sinceStart))} depuis le début du suivi
            </Badge>
          )}
        </div>
      </div>

      {/* Priorité du moment */}
      <Card className="animate-in delay-1">
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{
              background: `color-mix(in srgb, ${
                priority.severity === "good" ? "var(--good)" : priority.severity === "warning" ? "var(--warning)" : "var(--serious)"
              } 16%, transparent)`,
              color:
                priority.severity === "good" ? "var(--good-text)" : priority.severity === "warning" ? "var(--warning)" : "var(--serious)",
            }}
          >
            {priority.severity === "good" ? (
              <IconCheckCircle size={18} />
            ) : priority.severity === "warning" ? (
              <IconInfo size={18} />
            ) : (
              <IconAlertTriangle size={18} />
            )}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
                Priorité du moment
              </h2>
              <Badge tone={sevTone as "good"}>{priority.title}</Badge>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {priority.detail}
            </p>
            <Link
              to="/analyse"
              className="mt-2 inline-block text-sm font-medium"
              style={{ color: "var(--accent)" }}
            >
              Voir l'analyse complète →
            </Link>
          </div>
        </div>
      </Card>

      {/* Évolution */}
      {evolution && (
        <Card className="animate-in delay-2">
          <SectionTitle>Évolution du patrimoine net</SectionTitle>
          <div className="h-48">
            <ResponsiveContainer>
              <AreaChart data={evolution} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.38} />
                    <stop offset="65%" stopColor="var(--accent)" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: "var(--baseline)" }}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  width={46}
                  tickLine={false}
                  axisLine={false}
                  domain={["auto", "auto"]}
                  tickFormatter={(v: number) => `${Math.round(v / 1000)} k€`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [fmtEUR(Number(v)), "Patrimoine net"]}
                  cursor={{ stroke: "var(--baseline)", strokeDasharray: "3 3" }}
                />
                <Area
                  type="monotone"
                  dataKey="netWorth"
                  stroke="var(--accent)"
                  strokeWidth={2.25}
                  fill="url(#netWorthFill)"
                  dot={false}
                  activeDot={{ r: 4.5, stroke: "var(--surface-1)", strokeWidth: 2 }}
                  animationDuration={1100}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Répartition */}
      {donutData.length > 0 && (
        <Card className="animate-in delay-3">
          <SectionTitle>Répartition des actifs</SectionTitle>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="h-44 w-44 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={2}
                    stroke="var(--surface-1)"
                    strokeWidth={2}
                  >
                    {donutData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v, name) => [fmtEUR(Number(v)), String(name)]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full space-y-1.5">
              {donutData.map((d) => (
                <li key={d.name} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ background: d.color }}
                    aria-hidden
                  />
                  <span className="flex-1" style={{ color: "var(--text-secondary)" }}>
                    {d.name}
                  </span>
                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                    {fmtEUR(d.value)}
                  </span>
                  <span className="w-12 text-right text-xs" style={{ color: "var(--text-muted)" }}>
                    {fmtPct(d.pct, 0)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {/* Indicateurs essentiels */}
      <section>
        <SectionTitle>Indicateurs essentiels</SectionTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            className="animate-in delay-4"
            icon={<IconShield size={14} />}
            label="Taux d'endettement"
            value={m.totalIncome > 0 ? fmtPct(m.debtRatioPct) : "—"}
            sub={m.totalIncome > 0 ? "seuil usuel : 35 %" : "revenus non renseignés"}
            tone={m.debtRatioPct > 35 ? "critical" : m.debtRatioPct > 30 ? "warning" : undefined}
            help="Part de vos revenus consacrée aux mensualités de crédit (assurances incluses)."
          />
          <Stat
            className="animate-in delay-4"
            icon={<IconWallet size={14} />}
            label="Épargne mensuelle"
            value={fmtEUR(profile?.monthlySavings ?? 0)}
            sub={m.totalIncome > 0 ? `taux d'épargne ${fmtPct(m.savingsRatePct)}` : undefined}
            help="Montant mis de côté chaque mois, déclaré dans votre profil."
          />
          <Stat
            className="animate-in delay-5"
            icon={<IconShield size={14} />}
            label="Épargne de sécurité"
            value={m.emergencyMonths === null ? "—" : `${m.emergencyMonths.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} mois`}
            sub={`${fmtEUR(m.liquid)} disponibles`}
            tone={
              m.emergencyMonths !== null && m.emergencyMonths < 3
                ? "serious"
                : m.emergencyMonths !== null && m.emergencyMonths < 6
                  ? "warning"
                  : undefined
            }
            help="Nombre de mois de dépenses couverts par vos liquidités. Cible pédagogique : 3 à 6 mois."
          />
          <Stat
            className="animate-in delay-5"
            icon={<IconTrendingUp size={14} />}
            label="Revenus passifs"
            value={`${fmtEUR(m.passiveIncomeMonthly)}/mois`}
            sub="loyers nets + intérêts estimés"
            help="Revenus qui ne dépendent pas de votre travail : loyers nets de charges, intérêts de livrets."
          />
          <Stat
            className="animate-in delay-6"
            icon={<IconLayers size={14} />}
            label="Part liquide"
            value={fmtPct(m.liquidSharePct, 0)}
            help="Part du patrimoine mobilisable immédiatement sans vendre un actif long."
          />
          <Stat
            className="animate-in delay-6"
            icon={<IconBuilding size={14} />}
            label="Concentration immobilière"
            value={fmtPct(m.realEstateSharePct, 0)}
            tone={m.realEstateSharePct > 70 ? "warning" : undefined}
            help="Part de l'immobilier dans le patrimoine brut. Au-delà de 70 %, le risque de concentration augmente."
          />
          <Stat
            className="animate-in delay-7"
            icon={<IconAlertTriangle size={14} />}
            label="Actifs risqués"
            value={fmtPct(m.riskySharePct, 0)}
            tone={m.riskySharePct > 25 ? "warning" : undefined}
            help="Crypto et placements classés « risque élevé »."
          />
          <Stat
            className="animate-in delay-7"
            icon={<IconPin size={14} />}
            label="Reste à vivre"
            value={m.totalIncome > 0 ? fmtEUR(m.resteAVivre) : "—"}
            sub="revenus − mensualités"
            help="Ce qui reste chaque mois une fois les crédits payés."
          />
        </div>
      </section>

      <p className="pb-2 text-center text-[10px] leading-relaxed md:hidden" style={{ color: "var(--text-muted)" }}>
        Outil d'aide à la décision — ne remplace pas un conseiller financier, fiscal, juridique ou
        immobilier.
      </p>
    </div>
  );
}
