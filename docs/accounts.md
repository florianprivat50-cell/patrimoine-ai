# Comptes personnels

Les comptes utilisent **@netlify/identity 2** (email, mot de passe, confirmation, récupération et invitation) et **@netlify/blobs 11** pour une collection de documents privés, un document par identifiant utilisateur. Ce stockage documentaire convient à l'espace JSON actuel ; il ne s'agit pas d'une base SQL. Les mots de passe sont gérés par Identity, jamais stockés dans les documents applicatifs.

## Activation sur le site Netlify

1. Déployer la branche `astra-realestate-v3` avec `npm run build`, dossier publié `dist`, fonctions `netlify/functions`. Ne pas modifier main.
2. Dans **Project configuration → Identity**, activer Identity sur le site qui héberge réellement l'application. Ouvrir les inscriptions si elles doivent être publiques, garder la confirmation e-mail activée et vérifier les modèles/URL d'e-mails avec le domaine final HTTPS.
3. Netlify Blobs est provisionné par l'environnement des fonctions ; aucune clé privilégiée ne doit être ajoutée au navigateur. Les documents de production persistent entre les déploiements. Les previews utilisent un stockage propre au déploiement, séparé de la production.
4. Créer un compte depuis **Mode local · Se connecter**, confirmer l'e-mail, enregistrer une analyse, attendre **Sauvegardé dans mon compte**, puis se connecter au même compte dans un autre navigateur. Vérifier également la récupération du mot de passe via un véritable e-mail.

### Diagnostic du 22 septembre 2026

Le site `gregarious-moonbeam-d9e5b6` est accessible par le connecteur (ID `22a59d8c-ccd7-4c27-93b7-5b83228ce6d8`). Son endpoint public `/.netlify/identity/settings` répond `disable_signup: false`, `autoconfirm: false`, `external.email: true` : inscriptions ouvertes, confirmation obligatoire, conformément au choix de l’utilisateur. Aucun réglage Identity n’a été modifié.

Le déploiement de production `6aa99f5051e4072e89e91fdc` annonce une seule fonction. Son interface React et ses assets ne correspondent pas à cette branche et l’endpoint `/.netlify/functions/account` attendu par celle-ci renvoie une page HTML (200). Le bundle de production utilise en réalité `/api/workspace` (profil, biens, brouillon, historique), avec un schéma différent : aucune migration automatique entre ces espaces n’est revendiquée. Le formulaire de production affiche bien « Créer un compte » après chargement des réglages. Ne pas remplacer silencieusement cette production par une ancienne interface : livrer et contrôler l’aperçu distinct d’abord.

`netlify.toml` fixe désormais Node 24, le build, `dist` et le répertoire des fonctions. Le navigateur distingue un fallback HTML d’une réponse authentifiée. La confirmation et les liens expirés restent visibles après le chargement du compte ; un chargement bloqué permet de se reconnecter. L’inscription n’est proposée que si les réglages autorisent les comptes avec confirmation e-mail.

La réception réelle des e-mails, le retour des liens sur le bon domaine, la connexion sur deux navigateurs et l’accès au stockage Netlify sous session réelle restent des contrôles de mise en service. Les tests avec doubles ne les remplacent pas. Ne jamais désactiver la confirmation pour contourner ces contrôles.

## Données et fonctionnement

- Inclus : profil, actifs, crédits, objectifs, analyses avec leurs preuves, historique patrimonial, échanges et statuts du pipeline. Les brouillons du formulaire d'analyse ne deviennent des dossiers qu'après **Enregistrer cette opportunité**. La préférence de thème reste locale.
- Le serveur déduit la clé du document de l'utilisateur authentifié ; aucun identifiant fourni par le client ne choisit un autre compte. Lecture et écriture nécessitent une session et une adresse confirmée. L’en-tête `X-Account-Id` doit correspondre à la session vérifiée : il empêche une sauvegarde commencée pour A de partir sous la session B après un changement d’onglet. Il n’accorde aucun droit. Le client rejette aussi toute réponse d’une session précédente. Les mutations vérifient l'origine. Les réponses privées ont `no-store` et sont exclues du service worker.
- Écritures conditionnelles atomiques avec `onlyIfNew` / `onlyIfMatch` et lecture forte. Une révision périmée renvoie 409 et ouvre un choix explicite ; aucune fusion ou écrasement automatique.
- Les changements sont mis en attente localement par utilisateur et par onglet, puis envoyés après une courte pause. Le statut confirme seulement la réception du serveur. Une coupure conserve le brouillon ; le retour du réseau relance la synchronisation. Les brouillons d'anciens onglets sont récupérables depuis Mon compte. La mémoire applicative est vidée lors d'un changement de compte et la copie synchronisée locale est supprimée à la déconnexion.
- Le mode local existant est préservé séparément. Son import est volontaire ; les identifiants déjà présents dans le compte ne sont pas remplacés. La démonstration n'est pas enregistrée dans le compte.
- En cas de conflit, exporter la version locale avant de choisir la version du serveur ou son remplacement. En cas de session expirée, **Renouveler ma connexion** conserve les changements en attente.
- Limite explicite : document de 2 Mo, au plus 10 000 entrées par collection. Un dépassement échoue visiblement sans écraser le serveur. L'export JSON contient toutes les collections. Supprimer les données dans les paramètres synchronise un espace vide ; cela ne supprime pas l'identifiant de connexion. Pas d'historique serveur de restauration automatique : conserver des exports avant une suppression.
- Le mode hors connexion exige une session locale encore disponible ; une première connexion et la récupération de mot de passe nécessitent Internet. Les données en attente ne sont pas encore disponibles sur un autre appareil.
- Sans modifications en attente, les données distantes sont relues au retour sur l’application et toutes les 30 secondes lorsqu’elle est visible. Une démo ouverte pendant cette lecture ne peut pas être remplacée par la réponse tardive.

## Validation

`npm test` couvre l'isolation A/B, les appels non authentifiés, l'origine, les limites, les documents invalides, les écritures concurrentes et les erreurs de sauvegarde. `npm run check:server` vérifie les deux fonctions.

Cette livraison ajoute des tests du transport réel relié au gestionnaire serveur avec stockage/session simulés : deux appareils, conflits, changement de compte pendant le renouvellement, réponse tardive, compte non confirmé et réponse HTML. `npm test`, `npm run check:server` et `npm run build` réussissent (25 tests). Les tests navigateur historiques ci-dessous n’ont pas été exécutés lors de cette livraison.

`npm run test:accounts` utilise deux contextes navigateur et des transports Identity/compte simulés pour contrôler connexion, inscription, récupération, restauration, pipeline, conflit, mode hors ligne et déconnexion. Il ne remplace pas le contrôle des sessions et des e-mails réels sur Netlify. `BROWSER_EXECUTABLE` permet d'indiquer Chrome et `QA_OUTPUT_DIR` le dossier des captures. Les tests d'expérience/mobile restent disponibles.

Références : [Identity](https://docs.netlify.com/security/secure-access-to-sites/identity/), [stockage et écritures conditionnelles](https://docs.netlify.com/build/data-and-storage/netlify-blobs/). API vérifiée dans les types et le README des versions installées ; certaines anciennes notices ne décrivent pas les écritures conditionnelles.
