import { ReactNode, useMemo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { IconBuilding, IconHome, IconMap, IconSettings, IconSparkles, IconTarget, IconWallet } from "./icons";
import { computeMetrics } from "../lib/metrics";
import { fmtEUR } from "../lib/finance";
import { useStore } from "../store";

const NAV = [
  { to: "/", label: "Investir", Icon: IconBuilding, primary: true },
  { to: "/dashboard", label: "Vue d’ensemble", Icon: IconHome },
  { to: "/patrimoine", label: "Patrimoine", Icon: IconWallet },
  { to: "/carte", label: "Carte des deals", Icon: IconMap },
  { to: "/objectifs", label: "Objectifs", Icon: IconTarget },
  { to: "/analyse", label: "Assistant IA", Icon: IconSparkles },
  { to: "/profil", label: "Réglages", Icon: IconSettings },
];

const MOBILE_NAV = [
  { to: "/dashboard", label: "Vue", Icon: IconHome },
  { to: "/patrimoine", label: "Patrimoine", Icon: IconWallet },
  { to: "/", label: "Investir", Icon: IconBuilding, primary: true },
  { to: "/carte", label: "Deals", Icon: IconMap },
  { to: "/analyse", label: "IA", Icon: IconSparkles },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase() : "?";
}

export default function Layout({ children }: { children: ReactNode }) {
  const { demoMode, exitDemo, profile, assets, liabilities } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const netWorth = useMemo(() => computeMetrics(assets, liabilities, profile).netWorth, [assets, liabilities, profile]);

  return (
    <div className="app-shell">
      <aside className="modern-sidebar">
        <button className="brand-lockup" onClick={() => navigate("/")}>
          <span className="brand-mark">P</span>
          <span><strong>Patrimoine</strong><small>INTELLIGENCE PATRIMONIALE</small></span>
        </button>

        <div className="nav-caption">ESPACE INVESTISSEUR</div>
        <nav className="modern-nav">
          {NAV.map(({ to, label, Icon, primary }) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `${isActive ? "active" : ""} ${primary ? "primary" : ""}`}>
              <Icon size={18} strokeWidth={1.8}/><span>{label}</span>{primary && <em>CORE</em>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          {profile && <button className="profile-chip" onClick={() => navigate("/profil")}>
            <span>{initials(profile.firstName || "?")}</span>
            <div><strong>{profile.firstName}</strong><small>{fmtEUR(netWorth)} de patrimoine net</small></div>
          </button>}
          <p>Les scores sont des outils d’aide à la décision. Les hypothèses et incertitudes restent visibles.</p>
        </div>
      </aside>

      <div className="app-content">
        {demoMode && <div className="demo-banner"><span>Mode démonstration — données fictives</span><button onClick={() => { exitDemo(); navigate("/"); }}>Quitter</button></div>}
        <main key={location.pathname} className="page-stage">{children}</main>
      </div>

      <nav className="mobile-dock">
        {MOBILE_NAV.map(({ to, label, Icon, primary }) => (
          <NavLink key={label} to={to} end={to === "/"} className={({ isActive }) => `${isActive ? "active" : ""} ${primary ? "primary" : ""}`}>
            <span><Icon size={19} strokeWidth={1.9}/></span><small>{label}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
