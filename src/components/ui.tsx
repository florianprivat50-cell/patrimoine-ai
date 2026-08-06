import { ReactNode, useEffect, useState } from "react";
import { IconSparkles } from "./icons";

export function Card({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div className={`card ${onClick ? "card-hover cursor-pointer" : ""} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[26px] tracking-tight" style={{ color: "var(--text-primary)" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
        {children}
      </h2>
      {right}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
  help,
  icon,
  className = "",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "warning" | "serious" | "critical";
  help?: string;
  icon?: ReactNode;
  className?: string;
}) {
  const toneColor =
    tone === "good"
      ? "var(--good-text)"
      : tone === "warning"
        ? "var(--warning)"
        : tone === "serious"
          ? "var(--serious)"
          : tone === "critical"
            ? "var(--critical)"
            : "var(--text-primary)";
  const chipBg =
    tone === "good"
      ? "color-mix(in srgb, var(--good) 15%, transparent)"
      : tone === "warning"
        ? "color-mix(in srgb, var(--warning) 18%, transparent)"
        : tone === "serious" || tone === "critical"
          ? "color-mix(in srgb, var(--critical) 14%, transparent)"
          : "color-mix(in srgb, var(--accent) 12%, transparent)";
  return (
    <div className={`card card-hover !p-3.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          {label}
          {help && <InfoTip text={help} />}
        </div>
        {icon && (
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
            style={{ background: chipBg, color: toneColor === "var(--text-primary)" ? "var(--accent)" : toneColor }}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="mt-1 text-lg font-bold leading-tight" style={{ color: toneColor }}>
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/** Petite infobulle pédagogique : explique chaque terme technique */
export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="Explication"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        onBlur={() => setOpen(false)}
        className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
        style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
      >
        ?
      </button>
      {open && (
        <span
          className="absolute bottom-6 left-1/2 z-30 w-56 -translate-x-1/2 rounded-xl p-3 text-xs font-normal shadow-lg"
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

export function ProgressBar({ pct, color, delay = 0 }: { pct: number; color?: string; delay?: number }) {
  const target = Math.min(100, Math.max(0, pct));
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(target), 30 + delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, delay]);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--grid)" }}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${width}%`,
          background: color ?? "var(--accent)",
          transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)",
        }}
      />
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warning" | "serious" | "accent";
}) {
  const map: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: "var(--grid)", fg: "var(--text-secondary)" },
    good: { bg: "color-mix(in srgb, var(--good) 15%, transparent)", fg: "var(--good-text)" },
    warning: { bg: "color-mix(in srgb, var(--warning) 18%, transparent)", fg: "var(--text-primary)" },
    serious: { bg: "color-mix(in srgb, var(--critical) 14%, transparent)", fg: "var(--critical)" },
    accent: { bg: "color-mix(in srgb, var(--accent) 14%, transparent)", fg: "var(--accent)" },
  };
  const c = map[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: c.bg, color: c.fg }}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  placeholder,
  suffix,
  min,
  step,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  placeholder?: string;
  suffix?: string;
  min?: number;
  step?: number;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        inputMode="decimal"
        className="input pr-10"
        value={value === undefined || Number.isNaN(value) ? "" : value}
        min={min}
        step={step ?? "any"}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
      {suffix && (
        <span
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          {suffix}
        </span>
      )}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center animate-in"
      style={{ background: "rgba(0,0,0,0.5)", animationDuration: "0.2s" }}
      onClick={onClose}
    >
      <div
        className="animate-modal max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl"
        style={{ background: "var(--surface-1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Panneau repliable « Détail du calcul » : transparence des formules */
export function CalcDetail({ lines }: { lines: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs font-medium underline-offset-2 hover:underline"
        style={{ color: "var(--accent)" }}
      >
        {open ? "Masquer le détail du calcul" : "Détail du calcul"}
      </button>
      {open && (
        <ul
          className="mt-2 space-y-1 rounded-xl p-3 text-xs leading-relaxed"
          style={{ background: "var(--page)", color: "var(--text-secondary)" }}
        >
          {lines.map((l, i) => (
            <li key={i}>• {l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EmptyState({ title, body, cta }: { title: string; body: string; cta?: ReactNode }) {
  return (
    <div className="card animate-in flex flex-col items-center py-10 text-center">
      <div
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}
      >
        <IconSparkles size={20} className="animate-pulse" />
      </div>
      <div className="mt-3 font-semibold" style={{ color: "var(--text-primary)" }}>
        {title}
      </div>
      <p className="mt-1 max-w-xs text-sm" style={{ color: "var(--text-secondary)" }}>
        {body}
      </p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}
