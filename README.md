# Patrimoine IA

Copilote patrimonial : centralisez votre patrimoine, mesurez votre progression, analysez vos
projets et obtenez des recommandations chiffrées et justifiées.

## Lancer le projet

```bash
npm install
npm run dev        # http://localhost:5199
npm run build      # build de production dans dist/
```

## Ce que contient ce MVP

- **Onboarding** en 4 étapes (situation, objectifs, patrimoine, profil de risque)
- **Tableau de bord** : patrimoine net en temps réel, évolution, répartition par classe d'actifs,
  12 indicateurs (endettement, épargne de sécurité, revenus passifs, reste à vivre…),
  bloc « Priorité du moment » justifié par les chiffres
- **Patrimoine** : ajout / modification / suppression d'actifs (immobilier avec rendements et
  cash-flow, liquidités, placements financiers, crypto avec alerte de conservation, sociétés,
  autres) et de crédits (coût restant, intérêts futurs, date de désendettement)
- **Calculateur immobilier** : coût total, mensualité, rendements brut/net/net-net, cash-flow,
  TRI 20 ans, VAN, rentabilité des fonds propres, loyer d'équilibre, prix maximal conseillé,
  et **3 scénarios** (prudent / réaliste / optimiste) avec alerte si le projet ne tient
  qu'en scénario optimiste
- **Objectifs** : cible, échéance, versements, probabilité de réussite, trajectoire projetée
- **Analyse IA** : score de santé patrimoniale sur 100 (8 sous-scores pondérés) + conseiller
  conversationnel à base de règles, transparent (conclusion, données, hypothèses, risques,
  alternatives, actions, données manquantes)
- **Profil** : édition, thème clair/sombre/auto, export JSON, mode démonstration (données
  fictives clairement identifiées), suppression complète des données
- **PWA** installable (manifest + service worker), mobile-first avec navigation inférieure

## Transparence des calculs

Chaque résultat important propose un panneau « Détail du calcul » listant les formules et
hypothèses. Les formules sont documentées dans `src/lib/finance.ts`, `src/lib/realestate.ts`
et `src/lib/metrics.ts`.

## Architecture

- React 18 + TypeScript + Vite
- Tailwind CSS (thèmes clair/sombre via variables CSS)
- Zustand + persistance `localStorage` (aucune donnée n'est envoyée sur un serveur)
- Recharts pour les graphiques

Le stockage est local par conception dans ce MVP. Le store (`src/store.ts`) est le point
d'intégration unique pour brancher plus tard un backend (Supabase / API Node) : remplacer la
persistance locale par des appels réseau sans toucher aux pages.

## Limites connues (MVP)

- Pas d'authentification ni de synchronisation multi-appareils (données locales uniquement)
- Le « conseiller IA » est un moteur de règles local, pas un LLM — signalé comme tel dans l'UI
- Pas encore : documents, alertes programmées, rapport PDF, mode couple, analyse géographique,
  administration, abonnements

⚠️ L'application fournit des outils d'aide à la décision et ne remplace pas un conseiller
financier, fiscal, juridique ou immobilier.
