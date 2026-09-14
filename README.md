# Patrimoine AI — moteur immobilier V3

L’accueil analyse une annonce, conserve les preuves avec le dossier et partage le même score avec Mes analyses et l’assistant. Identité : bleu nuit/noir, or champagne, Playfair Display et DM Sans.

## Développement et vérification

Node **24+** est nécessaire pour le lanceur de tests.

```sh
npm ci
npm test
npm run check:server
npm run build
npm run dev
```

Test du build et du parcours mobile, dans deux terminaux :

```sh
npm run preview:qa
# Dans le second terminal :
npx playwright install chromium
npm run test:mobile
```

Le serveur QA sert `dist` et la vraie fonction sur localhost:5199. Les tests mobiles interceptent l’extraction avec une fixture explicite pour être reproductibles ; ils ne prouvent pas l’accès à tous les portails. `BROWSER_EXECUTABLE` peut désigner un Chromium installé. `QA_OUTPUT_DIR` choisit le dossier des captures. Ces tests couvrent l’import, le transfert des loyers/charges, la sauvegarde/relecture des preuves, la cohérence des scores, le prix cible inaccessible, l’assistant et l’échec d’une seconde annonce. Largeurs : 360, 390, 768, 1440 px.

## Pipeline et provenance

1. **URL HTTPS publique** : résolution DNS IPv4 vérifiée et épinglée à la connexion, contrôle de chaque redirection, limite de taille pendant la lecture et délai par requête. Les pages privées, protections antibot et contenus rendus exclusivement côté navigateur peuvent rester inaccessibles. Aucune tentative de contournement.
2. **Extraction** : entité immobilière JSON-LD, chemins explicites de l’état applicatif, métadonnées et description/texte principal. Les recommandations et objets d’agence ne sont pas parcourus récursivement. Les valeurs contradictoires restent à compléter. Plusieurs formats d’une même annonce constituent une déclaration vendeur, pas plusieurs confirmations indépendantes.
3. **Localisation IGN/BAN** : seuil de pertinence, cohérence postale et détection d’ambiguïté entre communes. La précision (commune/adresse) est conservée. Une annonce peut encore désigner une ville proche : la localisation du bien doit être confirmée.
4. **DVF officiel DGFiP/Etalab** : fichiers communaux des deux derniers millésimes annuels ; ventes simples dans les 24 derniers mois, même commune, même type maison/appartement et surface ±35 %. Les transactions à plusieurs lignes sont exclues par prudence. Médiane à partir de 5 ventes seulement ; nombre, identifiants, dates et prix des comparables conservés (50 exemples maximum). Aucun rapprochement automatique d’un immeuble entier avec des appartements isolés. Des ventes comparables peuvent être exclues : c’est un échantillon conservateur, pas une expertise.
5. **Géorisques/GASPAR** : risques recensés dans la commune ; aucune conversion artificielle en risque numérique de la parcelle. Il faut l’ERP, les diagnostics et les devis pour aller plus loin.
6. **Finance** : prudent/réaliste/optimiste, coût complet, financement, rentabilités, cash-flow après fiscalité simplifiée et DSCR. Les hypothèses sont éditables. Le loyer d’équilibre utilise désormais la même fiscalité simplifiée que le cash-flow. Ce modèle ne remplace pas une simulation fiscale par régime.
7. **Score partagé** : économie 35 %, marché 25 %, stress 20 %, qualité/risques 12 %, preuves 8 %, puis plafonds et pénalités. Les preuves anciennes (90 jours), manquantes et contradictoires ne sont pas promues en données fiables. Comparables de vente/loyer insuffisants : plafond 68 ; risques techniques non vérifiés : plafond 78. Autres plafonds : DSCR, stress et fiabilité. Une donnée financière obligatoire invalide bloque la décision.

Sources et documentation :
- [Géocodage IGN](https://data.geopf.fr/geocodage/search?q=Avranches&limit=3)
- [DVF géolocalisées](https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres-geolocalisees)
- [Fichiers DVF](https://files.data.gouv.fr/geo-dvf/latest/csv/)
- [API Géorisques](https://www.data.gouv.fr/dataservices/api-georisques)

## Assistant et conservation

L’assistant immobilier utilise des **calculs déterministes**, sans LLM ni clé API. Il compare jusqu’à 10 dossiers dans sa réponse, demande le dossier concerné en cas d’ambiguïté, recalcule un prix pour atteindre un score donné et simule un budget travaux sans modifier la sauvegarde. Exemples : « Compare mes opportunités », « Quel prix pour atteindre 65/100 ? », « Simule 30 000 € de travaux ».

Le prix cible est recherché entre 1 € et le prix actuel, à hypothèses et qualité des preuves constantes. Il ne promet pas de franchir un plafond de preuve par une simple négociation. Les simulations ne constituent pas des offres envoyées.

Dossiers et preuves sont stockés dans le navigateur (Zustand/localStorage). L’analyse envoie l’URL au serveur ; l’actualisation locale transmet les données de localisation et de comparaison aux fonctions serveur. Les services externes reçoivent les requêtes nécessaires. Les anciens dossiers sans preuves restent lisibles mais leur score est recalculé prudemment. Changer l’adresse invalide les données locales ; changer la surface ou le type invalide les comparables. Le bouton d’actualisation permet la collecte locale même après un échec d’import.

## Limites explicites

- Pas de garantie d’extraction pour tous les portails : pas de navigateur distant, abonnement de données, OCR ou connecteur payant.
- Pas encore de collecte de comparables locatifs ni de statistiques INSEE de vacance/démographie. Le référentiel historique de prix affiché est indicatif et n’alimente plus le score.
- Pas de validation documentaire des baux, du DPE, des travaux, de la copropriété ou des risques de parcelle. Les plafonds de score restent donc délibérément restrictifs.
- Pas d’authentification, de synchronisation multi-appareils ni de LLM génératif.

## Validation de cette livraison

Tests du moteur et de dégradation des sources, vérification TypeScript client/serveur, build Vite et parcours mobile. Essai réseau réel le 14 septembre 2026 : IGN/BAN, Géorisques et DVF 2024/2025 accessibles pour Avranches ; 36 ventes simples retenues pour une maison de 100 m² selon les filtres ci-dessus. Ce résultat est un test du connecteur, pas une estimation individuelle.

Sur le poste Windows de validation, l’exécutable natif esbuild est bloqué par le bac à sable. Le build a été exécuté avec **esbuild-wasm 0.21.5**, même version que le compilateur natif, substitué uniquement dans les dépendances locales ignorées par Git. Les dépendances livrées restent celles de `package-lock.json`. Vite signale encore un bundle principal supérieur à 500 kB.
