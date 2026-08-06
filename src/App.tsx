import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { useStore } from "./store";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Patrimoine from "./pages/Patrimoine";
import Projets from "./pages/Projets";
import Carte from "./pages/Carte";
import Objectifs from "./pages/Objectifs";
import Analyse from "./pages/Analyse";
import Profil from "./pages/Profil";

export default function App() {
  const onboarded = useStore((s) => s.onboarded);

  if (!onboarded) return <Onboarding />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/patrimoine" element={<Patrimoine />} />
        <Route path="/projets" element={<Projets />} />
        <Route path="/carte" element={<Carte />} />
        <Route path="/objectifs" element={<Objectifs />} />
        <Route path="/analyse" element={<Analyse />} />
        <Route path="/profil" element={<Profil />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
