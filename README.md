# Patrimoine AI — moteur immobilier V3

L’accueil analyse une annonce, conserve les preuves avec le dossier et partage le même score avec Mes analyses et l’assistant. Identité : bleu nuit/noir, or champagne, Playfair Display et DM Sans.

## État des comptes — 22 septembre 2026

Cette branche contient l’accès personnel par e-mail/mot de passe et la sauvegarde privée avec Netlify Identity et Blobs. `main` décrit encore le MVP local historique. Les changements de compte sont livrés séparément de la PR visuelle #1.

Sur le site `gregarious-moonbeam-d9e5b6`, Identity répond avec inscriptions ouvertes et confirmation e-mail obligatoire. Le code servi en production diffère de cette branche ; l’endpoint `/.netlify/functions/account` attendu ici y renvoie actuellement du HTML. L’activation d’Identity seule ne prouve donc pas le déploiement de cette implémentation ni la synchronisation de ses données. Voir [le diagnostic et les vérifications](docs/accounts.md).

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

Dossiers et preuves du mode local sont stockés dans le navigateur. Après connexion, les données du compte sont sauvegardées côté serveur et les modifications en attente restent sur l’appareil jusqu’à confirmation de leur réception. L’analyse envoie l’URL au serveur ; l’actualisation locale transmet les données de localisation et de comparaison aux fonctions serveur. Les services externes reçoivent les requêtes nécessaires. Les anciens dossiers sans preuves restent lisibles mais leur score est recalculé prudemment. Changer l’adresse invalide les données locales ; changer la surface ou le type invalide les comparables. Le bouton d’actualisation permet la collecte locale même après un échec d’import.

## Limites explicites

- Pas de garantie d’extraction pour tous les portails : pas de navigateur distant, abonnement de données, OCR ou connecteur payant.
- Pas encore de collecte de comparables locatifs ni de statistiques INSEE de vacance/démographie. Le référentiel historique de prix affiché est indicatif et n’alimente plus le score.
- Pas de validation documentaire des baux, du DPE, des travaux, de la copropriété ou des risques de parcelle. Les plafonds de score restent donc délibérément restrictifs.
- Pas de LLM génératif. Comptes et synchronisation : voir docs/accounts.md.

## Validation de cette livraison

Tests du moteur et de dégradation des sources, vérification TypeScript client/serveur, build Vite et parcours mobile. Essai réseau réel le 14 septembre 2026 : IGN/BAN, Géorisques et DVF 2024/2025 accessibles pour Avranches ; 36 ventes simples retenues pour une maison de 100 m² selon les filtres ci-dessus. Ce résultat est un test du connecteur, pas une estimation individuelle.

Sur le poste Windows de validation, l’exécutable natif esbuild est bloqué par le bac à sable. Le build a été exécuté avec **esbuild-wasm 0.21.5**, même version que le compilateur natif, substitué uniquement dans les dépendances locales ignorées par Git. Les dépendances livrées restent celles de `package-lock.json`. Vite signale encore un bundle principal supérieur à 500 kB.

## Expérience ordinateur et application — 15 septembre 2026

- Barre d’application et installation guidée (invitation native quand elle est disponible ; instructions Safari sur iPhone/iPad et menu du navigateur ailleurs).
- Icônes PNG 192/512 px, icône maskable, icône Apple 180 px, manifeste standalone avec raccourcis.
- Cache de tous les fichiers nécessaires à l’interface, généré à chaque build et versionné par empreinte du contenu. Les API, les sources externes et les données privées du serveur ne sont pas mises en cache. Le mode local reste propre à cet appareil. Les comptes connectés utilisent la synchronisation décrite dans docs/accounts.md.
- Première connexion nécessaire pour télécharger l’interface. Les cartes distantes, la collecte d’annonces et l’actualisation des sources nécessitent toujours Internet.
- Nouvelle version proposée via « Mettre à jour », sans rechargement forcé pendant une saisie. Conserver son dossier avant d’accepter. Le cache précédent reste disponible pour les autres onglets ouverts.
- Transitions de navigation, progression indéterminée pendant la collecte, animation du score, retours de focus/clic et de sauvegarde. Effets de survol réservés à la souris et respect de `prefers-reduced-motion`.
- Zones tactiles, marges de sécurité des téléphones, boîte de dialogue accessible au clavier et lien d’accès direct au contenu. Les résultats financiers restent masqués tant que les données minimales ne sont pas renseignées.
- Pages secondaires chargées à la demande : fichier JavaScript principal passé d’environ 924 Ko à 250 Ko avant compression (269 Ko à 83 Ko compressés). Le téléchargement de préparation du mode hors connexion conserve les autres fichiers de l’application.

Vérifications supplémentaires :

```sh
npm run build
npm run test:experience
```

Ce test démarre son propre serveur local sur le port 5201. Il contrôle les critères d’installation Chromium (hors restriction inhérente au contexte privé du test), le dialogue et son focus, les instructions iPhone, cinq largeurs de 360 à 1440 px, les effets et leur désactivation, l’ouverture d’une route non encore visitée et son rechargement **serveur arrêté**, l’exclusion des API du cache, et l’activation explicite d’une mise à jour sans perte de la saisie avant acceptation. Ce sont des tests navigateur : l’installation sur un iPhone physique et la publication sur les boutiques Apple/Google ne sont pas réalisées.

Références : [installation des PWA (MDN)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [invitation d’installation (MDN)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt).

## Comptes personnels

Connexion, sauvegarde privée et synchronisation : [activation et fonctionnement](docs/accounts.md). L’activation Identity sur le site Netlify est nécessaire.
