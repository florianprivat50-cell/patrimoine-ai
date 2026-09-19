# Patrimoine AI — Atelier interface 01

Date : 19 septembre 2026. Statut : proposition non validée, non fusionnée, non publiée en production.

## Référence et périmètre

Branche de travail : `atelier-interface-01`, créée depuis `astra-realestate-v3` au commit `829f1c23ca69bf091b61e018c3fefc483870b263` (comptes et synchronisation du 15 septembre).

Cette livraison ne prétend pas reproduire le site distinct `patrimoine-ai-analyse.yzbym5jn2s.chatgpt.site`, dont la dernière interface n'a pas pu être récupérée. Les anciennes captures et la vidéo ne sont pas disponibles dans cet environnement : aucune fidélité exacte à ces sources n'est revendiquée.

Objectif : juger un premier écran réellement interactif avant de modifier toute l'application. L'atelier est isolé dans `public/atelier/` : aucune modification du routage, du store, des comptes, des données existantes, des fonctions Netlify ou des protections d'accès.

## Direction proposée

Fond clair, navigation bleu nuit, détails champagne, illustration architecturale vectorielle, typographie système sans fichier de police externe. Un bouton principal pour analyser, une liste de dossiers lisible et une navigation mobile courte. Les arguments secondaires disparaissent sur petit écran pour faire remonter les dossiers.

Parcours : Mes dossiers → Le bien → Les chiffres → Synthèse → Enregistrer. Financement et charges dans un panneau repliable ; les hypothèses restent identifiables. Recherche, favoris, tri et curseur de simulation du prix sont fonctionnels. Les exemples fictifs sont séparés des dossiers personnels.

## Fichiers et lancement

- `public/atelier/index.html` : structure, libellés, formulaires et illustrations.
- `public/atelier/atelier.css` : présentation responsive et mouvements réduits.
- `public/atelier/atelier.js` : interactions, validation et stockage local propre à cet atelier.

Aucune dépendance ajoutée. Depuis la racine du dépôt : `python3 -m http.server 8080 --directory public`, puis ouvrir `/atelier/`. Après un build Vite et un déploiement de cette branche, cette page doit être servie à `/atelier/` ; cette route déployée n'a pas été vérifiée ici.

## Vérifications exécutées

25 contrôles réussis dans Chromium : ouverture sans faux dossier personnel ; exemples explicitement fictifs ; recherche et résultat vide ; favoris ; variation de prix ; validation obligatoire ; progression guidée ; calcul à taux nul ; comparaison indépendante du cash-flow ; accusé après écriture ; sérialisation puis relecture dans une nouvelle page ; séparation des exemples ; apport excessif refusé ; conservation d'une URL sans extraction prétendue ; fermeture au clavier ; absence de débordement à 360, 390, 430, 768 et 1440 px ; modale contenue sur mobile ; respect de `prefers-reduced-motion` ; échec de stockage signalé ; absence d'erreur JavaScript dans ces parcours.

IMPORTANT : la politique du navigateur de test bloquait la navigation URL/fichier. Le code a été rendu par `set_content`, et le stockage a été remplacé explicitement par un double de test en mémoire. La sérialisation et les erreurs de sauvegarde ont été testées, pas la persistance durable dans Safari ou sur l'iPhone réel. Aucun test d'authentification ou de synchronisation cloud n'a été exécuté. Aucun audit complet d'accessibilité, test de sécurité ou build complet de l'application existante n'est revendiqué.

Les trois fichiers poussés ont été comparés par leur SHA Git aux fichiers utilisés pour le rendu local : CSS `16a604980c6ba2efb6df3ce286f6a20844f4a391`, JS `bbbaa27a037bc32917c04e4150febe9e4c1d6d73`, HTML `6c01fc9bf212556f924cc2830a16092d92a36160`.

## Limites explicites

La clé locale `patrimoine-ai:atelier-01:v1` n'accède jamais au compte de l'application. L'enregistrement est manuel, sur ce navigateur seulement, sans chiffrement fourni par cette page. L'interface annonce les erreurs plutôt que de confirmer une sauvegarde inexistante. Ne pas saisir de données sensibles. La copie d'un exemple porte le préfixe `[Exemple fictif]`.

Le lien d'annonce est conservé comme référence ; aucune extraction, DVF, carte ou collecte de risques n'est raccordée dans cet atelier. Les calculs illustratifs sont avant fiscalité et ne remplacent pas `computeDeal` / `projectFeasibility` de l'application. Aucun score IA, revenu réel ou donnée locale n'est inventé. Les valeurs par défaut sont des hypothèses, pas des taux de marché.

L'accès SSO Netlify reste actif d'après le connecteur. Il n'a pas été désactivé. Aucun déploiement en production n'a été effectué.

## Suite après validation de l'utilisateur

Porter uniquement la direction approuvée dans les composants React existants ; conserver et réutiliser le moteur de calcul, le store et les comptes ; raccorder les interactions aux vraies données ; vérifier ensuite la création, la reprise, la sauvegarde interappareils, les droits entre deux comptes et le parcours sur iPhone avant toute substitution à l'accueil actuel. Ne pas remplacer les modèles financiers par ceux de l'atelier et ne pas migrer automatiquement les données de démonstration.
