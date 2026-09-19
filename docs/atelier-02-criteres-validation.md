# Patrimoine AI — critères de validation de la version connectée

Date : 19 septembre 2026.

## Décision utilisateur

L’interface Atelier 01 est la référence approuvée : Florian la trouve nettement plus simple, surtout sur téléphone. Conserver cette direction visuelle et le parcours guidé. Ne pas refaire l’interface ou réintroduire tous les champs sur un même écran.

La suite doit impérativement associer : compte personnel e-mail/mot de passe, conservation des données personnelles, financement complet et prise en compte réelle de la localisation dans l’analyse de rentabilité.

Ce document fixe les critères ; il ne prétend pas que l’atelier est déjà raccordé. Aucun compte réel, e-mail de récupération ou parcours de sauvegarde interappareils n’a été testé pendant cette revue. Aucun déploiement de production n’est autorisé par ce document.

## État vérifié par lecture du code

- `src/lib/account.ts`, `src/lib/accountData.ts`, `src/components/AccountAccess.tsx`, `netlify/functions/account.mts` : composants existants pour Identity, documents privés par compte, états de synchronisation et gestion des conflits. À réutiliser, pas de seconde base ni de mots de passe gérés dans l’atelier.
- `src/lib/realestate.ts`, `src/lib/deal.ts` : crédit, assurance, apport, frais, charges et scénarios présents. L’atelier utilise encore un calculateur indépendant : le remplacer par l’utilisation du moteur partagé, sans régression des calculs ni double comptage des frais.
- `netlify/functions/_shared/local-data.ts` : géocodage IGN/BAN, ventes DVF communales filtrées et risques communaux Géorisques. Les loyers de marché et la vacance locale sont explicitement non vérifiés. Les données DVF d’appartements isolés ne sont pas considérées comme des comparables d’un immeuble entier.
- `src/lib/evidence.ts` : changement de localisation invalide les preuves géographiques ; un changement de type ou de surface invalide les comparables. Conserver ce mécanisme.
- Le stockage des aperçus Netlify est isolé par déploiement ; ne jamais le présenter comme le stockage permanent de production. Vérifier le site et le contexte de déploiement avant d’encourager la saisie de données réelles.

## 1. Compte personnel et sauvegarde

Exiger la connexion pour l’espace personnel. Distinguer clairement démonstration et compte réel. Réutiliser les comptes et dossiers existants ; aucune migration destructive ni import automatique d’exemples.

La sauvegarde automatique doit couvrir les modifications d’un dossier ET les brouillons de saisie utiles, pas seulement les dossiers finalisés. Afficher « En attente », « En cours », « Sauvegardé dans mon compte » ou une erreur ; seule une réponse serveur positive autorise la dernière mention. Les dossiers inachevés restent identifiés comme brouillons et ne reçoivent pas un résultat complet.

Tests d’acceptation à exécuter sur l’environnement final :

1. Créer un compte, confirmer l’e-mail, se connecter, se déconnecter et récupérer le mot de passe via les vrais e-mails.
2. Commencer une analyse sur téléphone, attendre la confirmation de sauvegarde, fermer, se reconnecter et retrouver les champs.
3. Ouvrir le même dossier avec le même compte dans un navigateur vierge ; vérifier la reprise et les modifications.
4. Compte B : aucun accès aux dossiers de A, y compris par appel direct à l’API. Aucun reliquat visible après déconnexion ou changement de compte.
5. Couper le réseau pendant une modification : ne pas afficher une sauvegarde serveur ; conserver la copie en attente et synchroniser au retour du réseau.
6. Deux appareils modifient le même dossier : conserver une résolution de conflit explicite, sans écrasement silencieux.

## 2. Financement intégré à l’analyse

Distinguer trois notions dans la synthèse : rendement du bien, cash-flow après financement, rendement des fonds propres. Le crédit ne doit pas être artificiellement déduit du rendement brut de l’actif.

Prendre en compte le prix, les frais d’acquisition, les frais d’agence uniquement s’ils ne sont pas déjà inclus, travaux, mobilier, frais de dossier/garantie, apport, capital réellement emprunté, taux, durée, assurance et charges d’exploitation. Les valeurs préremplies restent des hypothèses modifiables, pas des données de marché ou une offre bancaire.

Présenter la mensualité assurance comprise, le coût total, le cash-flow avant fiscalité et le point d’équilibre. Ne pas qualifier de « net réel après impôts » l’hypothèse fiscale simplifiée du moteur actuel ; une fiscalité par régime nécessite une implémentation et une validation distinctes.

Tests : taux nul ; apport couvrant le coût total ; apport supérieur au coût total refusé ; durée et taux invalides ; recomposition du cash-flow à partir des lignes affichées ; variation du taux, de l’apport et de la durée modifiant correctement la trésorerie ; concordance entre carte, synthèse et dossier.

## 3. Localisation ayant un effet traçable

La ville ne doit pas être un simple libellé. Elle ne doit pas non plus appliquer un bonus ou malus de rentabilité arbitraire. À prix, loyers, charges, vacance et financement identiques, le rendement mathématique reste identique ; les écarts entre lieux doivent venir de données ou d’hypothèses explicites et différentes.

Conserver l’adresse lorsque connue, la commune/code INSEE, le code postal et la précision effective du géocodage. Une référence communale n’est pas une référence au quartier ; un risque communal n’est pas une exposition prouvée de la parcelle.

Distinguer dans la synthèse :

- La rentabilité sur les chiffres saisis ou les baux fournis.
- La cohérence du prix d’achat avec des ventes comparables disponibles, avec type, période, périmètre et taille d’échantillon.
- Un scénario locatif local documenté : loyer hors charges retenu et vacance retenue, sources/dates et hypothèses affichées. Recalculer réellement le cash-flow et les rendements avec ces entrées, sans écraser silencieusement les chiffres d’origine.
- Les incertitudes et risques non chiffrables sans preuves : ne pas les transformer automatiquement en pourcentage de coût.

Pour un immeuble, les références locatives doivent respecter la composition des lots ; ne pas multiplier aveuglément un loyer d’appartement type par toute la surface, parties communes ou local commercial inclus.

Les indicateurs ANIL 2025 identifiés pendant la revue sont des loyers d’annonce **charges comprises**, modélisés pour des logements types loués vides, à l’échelle communale ou d’une maille regroupée. Ne pas les injecter tels quels dans un moteur demandant des loyers hors charges ; pas de retrait forfaitaire inventé. Les loyers réellement encaissés doivent rester distincts de ces estimations. La vacance du parc immobilier ne doit pas être assimilée au délai de relocation.

Source officielle examinée : https://www.data.gouv.fr/datasets/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025
Attribution requise en cas d’utilisation : « Estimations ANIL, à partir des données du Groupe SeLoger et de leboncoin ».

Les téléchargements du CSV et l’API tabulaire n’ont pas été accessibles depuis l’environnement de cette revue : aucune intégration ANIL opérationnelle ni lecture des observations n’est revendiquée.

Tests d’acceptation : deux communes disposant de références distinctes produisent des scénarios locaux distincts avec le même financement ; conversion CC/HC explicite ; absence de données = analyse locale incomplète, jamais valeur zéro ou estimation fabriquée ; changement d’adresse invalide les anciennes preuves ; réponse réseau tardive pour l’ancienne adresse ou l’ancien utilisateur ignorée ; source périmée/insuffisante signalée ; cas immeuble/local commercial traité sans faux comparables.

## Critère final

Un même dossier doit conserver l’interface mobile approuvée, être retrouvé après reconnexion, expliquer son financement et montrer quelles données du lieu changent son résultat. Une belle interface seule ou une carte sans effet sur les hypothèses ne satisfait pas la demande.
