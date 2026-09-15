import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
const Onboarding=lazy(()=>import('./pages/Onboarding'));
import Investir from "./pages/Investir";
const Dashboard=lazy(()=>import('./pages/Dashboard'));
const Patrimoine=lazy(()=>import('./pages/Patrimoine'));
const Projets=lazy(()=>import('./pages/Projets'));
const Opportunites=lazy(()=>import('./pages/Opportunites'));
const Carte=lazy(()=>import('./pages/Carte'));
const Objectifs=lazy(()=>import('./pages/Objectifs'));
const Analyse=lazy(()=>import('./pages/Analyse'));
const Profil=lazy(()=>import('./pages/Profil'));
export default function App(){return <Layout><Suspense fallback={<div className="route-loading" role="status">Ouverture de votre espace…</div>}><Routes><Route path="/" element={<Investir/>}/><Route path="/onboarding" element={<Onboarding/>}/><Route path="/dashboard" element={<Dashboard/>}/><Route path="/patrimoine" element={<Patrimoine/>}/><Route path="/projets" element={<Opportunites/>}/><Route path="/projets/expert" element={<Projets/>}/><Route path="/carte" element={<Carte/>}/><Route path="/objectifs" element={<Objectifs/>}/><Route path="/analyse" element={<Analyse/>}/><Route path="/profil" element={<Profil/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></Suspense></Layout>}
