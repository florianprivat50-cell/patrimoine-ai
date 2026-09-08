import { ReactNode, useMemo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { IconBuilding, IconHome, IconMap, IconSettings, IconSparkles, IconTarget, IconWallet } from "./icons";
import { computeMetrics } from "../lib/metrics";
import { fmtEUR } from "../lib/finance";
import { useStore } from "../store";

const NAV = [
  { to: "/", label: "Accueil", Icon: IconHome },
  { to: "/projets", label: "Analyses", Icon: IconBuilding },
  { to: "/dashboard", label: "Patrimoine", Icon: IconWallet },
  { to: "/carte", label: "Marché", Icon: IconMap },
  { to: "/analyse", label: "Assistant IA", Icon: IconSparkles },
  { to: "/objectifs", label: "Objectifs", Icon: IconTarget },
  { to: "/profil", label: "Paramètres", Icon: IconSettings },
];

const MOBILE_NAV = [
  { to: "/", label: "Accueil", Icon: IconHome },
  { to: "/projets", label: "Analyses", Icon: IconBuilding },
  { to: "/analyse", label: "Assistant", Icon: IconSparkles },
  { to: "/profil", label: "Paramètres", Icon: IconSettings },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase() : "FP";
}

export default function Layout({ children }: { children: ReactNode }) {
  const { demoMode, exitDemo, profile, assets, liabilities } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const netWorth = useMemo(() => computeMetrics(assets, liabilities, profile).netWorth, [assets, liabilities, profile]);

  return <div className="app-shell luxury-shell">
    <aside className="modern-sidebar luxury-sidebar">
      <button className="brand-lockup luxury-brand" onClick={() => navigate("/")}>
        <span><strong>PATRIMOINE <i>AI</i></strong><small>ANALYSE · OPTIMISE · INVESTIS</small></span>
      </button>
      <div className="nav-caption">NAVIGATION</div>
      <nav className="modern-nav">{NAV.map(({to,label,Icon}) => <NavLink key={to} to={to} end={to==="/"} className={({isActive})=>isActive?"active":""}><Icon size={18}/><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-foot">{profile && <button className="profile-chip" onClick={()=>navigate("/profil")}><span>{initials(profile.firstName||"FP")}</span><div><strong>{profile.firstName}</strong><small>{fmtEUR(netWorth)} net</small></div></button>}<p>Analyse indépendante. Les hypothèses et la confiance des données restent visibles.</p></div>
    </aside>
    <div className="app-content">
      {demoMode && <div className="demo-banner"><span>Mode démonstration</span><button onClick={()=>{exitDemo();navigate("/")}}>Quitter</button></div>}
      <main key={location.pathname} className="page-stage">{children}</main>
    </div>
    <nav className="mobile-dock luxury-dock">{MOBILE_NAV.map(({to,label,Icon})=><NavLink key={label} to={to} end={to==="/"} className={({isActive})=>isActive?"active":""}><span><Icon size={20}/></span><small>{label}</small></NavLink>)}</nav>
  </div>;
}
