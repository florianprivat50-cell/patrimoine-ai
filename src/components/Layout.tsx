import { ReactNode, useMemo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  IconBuilding,
  IconHome,
  IconMap,
  IconPlus,
  IconSettings,
  IconSparkles,
  IconTarget,
  IconWallet,
} from "./icons";
import { computeMetrics } from "../lib/metrics";
import { fmtEUR } from "../lib/finance";
import { useStore } from "../store";

const NAV = [
  { to: "/", label: "Accueil", Icon: IconHome },
  { to: "/patrimoine", label: "Patrimoine", Icon: IconWallet },
  { to: "/projets", label: "Analyser un bien", Icon: IconBuilding },
  { to: "/carte", label: "Carte", Icon: IconMap },
  { to: "/objectifs", label: "Objectifs", Icon: IconTarget },
  { to: "/analyse", label: "Analyse IA", Icon: IconSparkles },
  { to: "/profil", label: "Profil", Icon: IconSettings },
];

// Barre mobile : 5 accès (Accueil, Patrimoine, Analyser, Carte, IA)
const MOBILE_NAV = [
  { to: "/", label: "Accueil", Icon: IconHome },
  { to: "/patrimoine", label: "Patrimoine", Icon: IconWallet },
  { to: "/projets", label: "Analyser", Icon: IconPlus, isAdd: true },
  { to: "/carte", label: "Carte", Icon: IconMap },
  { to: "/analyse", label: "IA", Icon: IconSparkles },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function Layout({ children }: { children: ReactNode }) {
  const { demoMode, exitDemo, profile, assets, liabilities } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const netWorth = useMemo(
    () => computeMetrics(assets, liabilities, profile).netWorth,
    [assets, liabilities, profile]
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl">
      {/* Barre latérale desktop */}
      <aside
        className="sidebar-glass sticky top-0 hidden h-dvh w-60 shrink-0 flex-col p-3 md:flex"
        style={{ borderRight: "1px solid var(--border)" }}
      >
        <div className="mb-5 flex items-center gap-2.5 px-2 pt-1">
          <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg shadow-sm" />
          <div>
            <div className="font-display text-[17px] leading-tight" style={{ color: "var(--text-primary)" }}>
              Patrimoine IA
            </div>
            <div className="text-[10px] font-medium tracking-wide" style={{ color: "var(--text-muted)" }}>
              COPILOTE PATRIMONIAL
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className="group relative flex items-center gap-2.5 overflow-hidden rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200"
              style={({ isActive }) => ({
                background: isActive ? "var(--surface-1)" : "transparent",
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                boxShadow: isActive ? "0 1px 2px rgba(16,32,26,0.06)" : "none",
              })}
            >
              {({ isActive }) => (
                <>
                  <span
                    className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full transition-all duration-200"
                    style={{
                      background: "var(--accent)",
                      opacity: isActive ? 1 : 0,
                      transform: isActive ? "translateY(-50%) scaleY(1)" : "translateY(-50%) scaleY(0)",
                    }}
                  />
                  <Icon
                    size={18}
                    strokeWidth={1.8}
                    className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-3">
          {profile && (
            <button
              onClick={() => navigate("/profil")}
              className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition hover:brightness-95"
              style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: "var(--accent)" }}
              >
                {initials(profile.firstName || "?")}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {profile.firstName}
                </span>
                <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {fmtEUR(netWorth)} net
                </span>
              </span>
            </button>
          )}
          <p className="px-2 text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Outil d'aide à la décision. Ne remplace pas un conseiller financier, fiscal, juridique ou
            immobilier.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {demoMode && (
          <div
            className="sticky top-0 z-40 flex items-center justify-between gap-2 px-4 py-2 text-xs font-medium text-white"
            style={{ background: "var(--accent)" }}
          >
            <span className="flex items-center gap-1.5">
              <IconSparkles size={14} /> Mode démonstration — toutes les données affichées sont fictives
            </span>
            <button
              onClick={() => {
                exitDemo();
                navigate("/");
              }}
              className="shrink-0 rounded-full bg-white/20 px-3 py-1 font-semibold"
            >
              Quitter
            </button>
          </div>
        )}
        <main key={location.pathname} className="animate-in min-w-0 flex-1 px-4 pb-24 pt-4 sm:px-6 md:pb-8">
          {children}
        </main>
      </div>

      {/* Navigation inférieure mobile */}
      <nav
        className="sidebar-glass fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t pb-[env(safe-area-inset-bottom)] md:hidden"
        style={{ borderColor: "var(--border)" }}
      >
        {MOBILE_NAV.map(({ to, label, Icon, isAdd }) => (
          <NavLink
            key={label}
            to={to}
            end={to === "/"}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium"
            style={({ isActive }) => ({
              color: isActive && !isAdd ? "var(--accent)" : "var(--text-secondary)",
            })}
          >
            {isAdd ? (
              <span
                className="flex h-9 w-9 -translate-y-3 items-center justify-center rounded-full text-white shadow-lg"
                style={{ background: "var(--accent)" }}
              >
                <Icon size={18} strokeWidth={2} />
              </span>
            ) : (
              <Icon size={19} strokeWidth={1.8} />
            )}
            <span className={isAdd ? "-translate-y-2" : ""}>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
