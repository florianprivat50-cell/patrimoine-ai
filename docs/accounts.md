# Comptes personnels

Les comptes utilisent **@netlify/identity 2** (email, mot de passe, confirmation, récupération et invitation) et **@netlify/blobs 11** pour une collection de documents privés, un document par identifiant utilisateur. Ce stockage documentaire convient à l'espace JSON actuel ; il ne s'agit pas d'une base SQL. Les mots de passe sont gérés par Identity, jamais stockés dans les documents applicatifs.

## Activation sur le site Netlify

1. Déployer la branche `astra-realestate-v3` avec `npm run build`, dossier publié `dist`, fonctions `netlify/functions`. Ne pas modifier main.
2. Dans **Project configuration → Identity**, activer Identity sur le site qui héberge réellement l'application. Ouvrir les inscriptions si elles doivent être publiques, garder la confirmation e-mail activée et vérifier les modèles/URL d'e-mails avec le domaine final HTTPS.
3. Netlify Blobs est provisionné par l'environnement des fonctions ; aucune clé privilégiée ne doit être ajoutée au navigateur. Les documents de production persistent entre les déploiements. Les previews utilisent un stockage propre au déploiement, séparé de la production.
4. Créer un compte depuis **Mode local · Se connecter**, confirmer l'e-mail, enregistrer une analyse, attendre **Sauvegardé dans mon compte**, puis se connecter au même compte dans un autre navigateur. Vérifier également la récupération du mot de passe via un véritable e-mail.

Le site historique `gregarious-moonbeam-d9e5b6` n'était pas présent parmi les projets du connecteur Netlify lors de l'intégration. L'activation Identity et le test des e-mails réels sur ce site restent à réaliser par son gestionnaire ou après connexion au bon compte Netlify. Aucun autre site n'a été configuré par substitution.

## Données et fonctionnement

- Inclus : profil, actifs, crédits, objectifs, analyses avec leurs preuves, historique patrimonial, échanges et statuts du pipeline. Les brouillons du formulaire d'analyse ne deviennent des dossiers qu'après **Enregistrer cette opportunité**. La préférence de thème reste locale.
- Le serveur déduit la clé du document de l'utilisateur authentifié ; aucun identifiant fourni par le client ne choisit un autre compte. Lecture et écriture nécessitent une session. Les mutations vérifient l'origine. Les réponses privées ont `no-store` et sont exclues du service worker.
- Écritures conditionnelles atomiques avec `onlyIfNew` / `onlyIfMatch` et lecture forte. Une révision périmée renvoie 409 et ouvre un choix explicite ; aucune fusion ou écrasement automatique.
- Les changements sont mis en attente localement par utilisateur et par onglet, puis envoyés après une courte pause. Le statut confirme seulement la réception du serveur. Une coupure conserve le brouillon ; le retour du réseau relance la synchronisation. Les brouillons d'anciens onglets sont récupérables depuis Mon compte. La mémoire applicative est vidée lors d'un changement de compte et la copie synchronisée locale est supprimée à la déconnexion.
- Le mode local existant est préservé séparément. Son import est volontaire ; les identifiants déjà présents dans le compte ne sont pas remplacés. La démonstration n'est pas enregistrée dans le compte.
- En cas de conflit, exporter la version locale avant de choisir la version du serveur ou son remplacement. En cas de session expirée, **Renouveler ma connexion** conserve les changements en attente.
- Limite explicite : document de 2 Mo, au plus 10 000 entrées par collection. Un dépassement échoue visiblement sans écraser le serveur. L'export JSON contient toutes les collections. Supprimer les données dans les paramètres synchronise un espace vide ; cela ne supprime pas l'identifiant de connexion. Pas d'historique serveur de restauration automatique : conserver des exports avant une suppression.
- Le mode hors connexion exige une session locale encore disponible ; une première connexion et la récupération de mot de passe nécessitent Internet. Les données en attente ne sont pas encore disponibles sur un autre appareil.

## Validation

`npm test` couvre l'isolation A/B, les appels non authentifiés, l'origine, les limites, les documents invalides, les écritures concurrentes et les erreurs de sauvegarde. `npm run check:server` vérifie les deux fonctions.

`npm run test:accounts` utilise deux contextes navigateur et des transports Identity/compte simulés pour contrôler connexion, inscription, récupération, restauration, pipeline, conflit, mode hors ligne et déconnexion. Il ne remplace pas le contrôle des sessions et des e-mails réels sur Netlify. `BROWSER_EXECUTABLE` permet d'indiquer Chrome et `QA_OUTPUT_DIR` le dossier des captures. Les tests d'expérience/mobile restent disponibles.

Références : [Identity](https://docs.netlify.com/security/secure-access-to-sites/identity/), [stockage et écritures conditionnelles](https://docs.netlify.com/build/data-and-storage/netlify-blobs/). API vérifiée dans les types et le README des versions installées ; certaines anciennes notices ne décrivent pas les écritures conditionnelles.
