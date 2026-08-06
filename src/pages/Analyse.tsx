import { useEffect, useMemo, useRef, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { Badge, Card, PageHeader, ProgressBar, SectionTitle } from "../components/ui";
import { IconSparkles } from "../components/icons";
import { useCountUp } from "../hooks/useCountUp";
import { AdvisorAnswer, answerQuestion, SUGGESTED_QUESTIONS } from "../lib/advisor";
import { computeHealthScore, computeMetrics } from "../lib/metrics";
import { useStore, uid } from "../store";

const SHORT_LABEL: Record<string, string> = {
  securite: "Sécurité",
  endettement: "Endettement",
  epargne: "Épargne",
  diversification: "Diversif.",
  liquidite: "Liquidité",
  passifs: "Passifs",
  risque: "Risque",
  dettes: "Dettes",
};

export default function Analyse() {
  const { profile, assets, liabilities, chat, pushChat, clearChat } = useStore();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const m = useMemo(() => computeMetrics(assets, liabilities, profile), [assets, liabilities, profile]);
  const score = useMemo(() => computeHealthScore(m, profile), [m, profile]);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    pushChat({ id: uid(), role: "user", content: q, at: new Date().toISOString() });
    const a = answerQuestion(q, profile, assets, liabilities);
    pushChat({ id: uid(), role: "assistant", content: JSON.stringify(a), at: new Date().toISOString() });
    setInput("");
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const scoreColor =
    score.total >= 70 ? "var(--good)" : score.total >= 45 ? "var(--warning)" : "var(--critical)";
  const animatedScore = useCountUp(score.total, 900);
  const [ringPct, setRingPct] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setRingPct(score.total), 60);
    return () => clearTimeout(t);
  }, [score.total]);

  const radarData = useMemo(
    () => score.subs.map((s) => ({ subject: SHORT_LABEL[s.key] ?? s.label, score: Math.round(s.score), fullMark: 100 })),
    [score.subs]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analyse IA"
        subtitle="Score de santé et conseiller — moteur de règles transparent basé sur vos données"
      />

      {/* Score de santé */}
      <Card className="animate-in">
        <SectionTitle>Score de santé patrimoniale</SectionTitle>
        <div className="flex items-center gap-5">
          <div className="relative h-24 w-24 shrink-0">
            <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90">
              <circle cx="48" cy="48" r="40" fill="none" stroke="var(--grid)" strokeWidth="9" />
              <circle
                cx="48"
                cy="48"
                r="40"
                fill="none"
                stroke={scoreColor}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${(ringPct / 100) * 251.3} 251.3`}
                style={{ transition: "stroke-dasharray 1s cubic-bezier(0.16,1,0.3,1)" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl tabular-nums" style={{ color: "var(--text-primary)" }}>
                {Math.round(animatedScore)}
              </span>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                / 100
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-1 text-sm">
            {score.strengths.length > 0 && (
              <p style={{ color: "var(--text-secondary)" }}>
                <strong style={{ color: "var(--good-text)" }}>Points forts :</strong> {score.strengths.join(", ")}
              </p>
            )}
            {score.weaknesses.length > 0 && (
              <p style={{ color: "var(--text-secondary)" }}>
                <strong style={{ color: "var(--critical)" }}>À travailler :</strong> {score.weaknesses.join(", ")}
              </p>
            )}
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Indicateur pédagogique calculé sur vos données — pas une vérité absolue.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {score.subs.map((s, i) => (
            <div key={s.key}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span style={{ color: "var(--text-secondary)" }}>
                  {s.label}
                  <span className="ml-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                    pond. {s.weight} %
                  </span>
                </span>
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {Math.round(s.score)}
                </span>
              </div>
              <ProgressBar
                pct={s.score}
                delay={i * 70}
                color={s.score >= 70 ? "var(--good)" : s.score >= 45 ? "var(--warning)" : "var(--critical)"}
              />
              <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                {s.comment}
              </p>
            </div>
          ))}
        </div>

        {score.actions.length > 0 && (
          <div className="mt-4 rounded-xl p-3" style={{ background: "var(--page)" }}>
            <div className="mb-1.5 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Pour gagner des points
            </div>
            <ul className="space-y-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              {score.actions.map((a, i) => (
                <li key={i}>→ {a}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Profil du score — vue d'ensemble en un coup d'œil */}
      <Card className="animate-in delay-1">
        <SectionTitle>Profil du score</SectionTitle>
        <div className="h-64">
          <ResponsiveContainer>
            <RadarChart data={radarData} outerRadius="72%">
              <PolarGrid stroke="var(--grid)" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} tickCount={3} />
              <Radar
                dataKey="score"
                stroke="var(--accent)"
                strokeWidth={2}
                fill="var(--accent)"
                fillOpacity={0.28}
                animationDuration={900}
                animationEasing="ease-out"
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
          Plus la forme couvre le cercle, plus votre profil patrimonial est équilibré.
        </p>
      </Card>

      {/* Conseiller */}
      <Card className="animate-in delay-2">
        <SectionTitle
          right={
            chat.length > 0 ? (
              <button className="text-xs" style={{ color: "var(--text-muted)" }} onClick={clearChat}>
                Effacer
              </button>
            ) : undefined
          }
        >
          Conseiller patrimonial
        </SectionTitle>

        <div className="space-y-3">
          {chat.length === 0 && (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Posez une question sur votre situation. Les réponses s'appuient uniquement sur les
              données saisies, avec conclusions, hypothèses, risques et contre-arguments.
            </p>
          )}

          {chat.map((msg) =>
            msg.role === "user" ? (
              <div key={msg.id} className="animate-in flex justify-end">
                <div
                  className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm text-white"
                  style={{ background: "var(--accent)" }}
                >
                  {msg.content}
                </div>
              </div>
            ) : (
              <AssistantBubble key={msg.id} raw={msg.content} />
            )
          )}
          <div ref={bottomRef} />

          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                className="rounded-full px-3 py-1.5 text-xs transition hover:brightness-95"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", background: "var(--page)" }}
                onClick={() => ask(q)}
              >
                {q}
              </button>
            ))}
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <input
              className="input flex-1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Votre question…"
            />
            <button type="submit" className="btn-primary shrink-0">
              Envoyer
            </button>
          </form>

          <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Conseiller de démonstration : moteur de règles local, sans IA générative ni donnée
            externe. Éclairage pédagogique, pas un conseil en investissement personnalisé.
          </p>
        </div>
      </Card>
    </div>
  );
}

function AssistantBubble({ raw }: { raw: string }) {
  let a: AdvisorAnswer;
  try {
    a = JSON.parse(raw);
  } catch {
    return null;
  }
  const Section = ({ title, items, tone }: { title: string; items: string[]; tone?: string }) =>
    items.length === 0 ? null : (
      <div className="mt-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: tone ?? "var(--text-muted)" }}>
          {title}
        </div>
        <ul className="mt-0.5 space-y-0.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {items.map((x, i) => (
            <li key={i}>• {x}</li>
          ))}
        </ul>
      </div>
    );

  return (
    <div
      className="animate-scale-in max-w-[95%] rounded-2xl rounded-bl-md px-4 py-3"
      style={{ background: "var(--page)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent)" }}
          aria-hidden
        >
          <IconSparkles size={12} />
        </span>
        <p className="text-sm font-medium leading-snug" style={{ color: "var(--text-primary)" }}>
          {a.conclusion}
        </p>
      </div>
      <Section title="Données utilisées (faits)" items={a.data} />
      <Section title="Hypothèses retenues" items={a.hypotheses} />
      <Section title="Risques" items={a.risks} tone="var(--critical)" />
      <Section title="Scénarios alternatifs" items={a.alternatives} />
      {a.missing && <Section title="Données manquantes" items={a.missing} tone="var(--warning)" />}
      {a.actions.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {a.actions.map((x, i) => (
            <Badge key={i} tone="accent">
              → {x}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
