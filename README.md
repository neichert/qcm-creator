# Créateur de QCM

Application web (100 % navigateur, sans serveur) pour composer une évaluation et générer en un clic :

- **le sujet** du QCM en PDF, avec un cadre de note `… / total` (total = nombre de questions) ;
- **le corrigé** en PDF, avec les bonnes réponses cochées et les réponses attendues écrites en vert.

## Types de questions

| Type | Sujet | Corrigé |
| --- | --- | --- |
| Choix multiples | Cases carrées | Bonnes réponses cochées |
| Choix unique | Cases rondes | Bonne réponse cochée |
| Réponse courte | Une ligne | Réponse attendue |
| Réponse longue | N lignes (réglable) | Réponse attendue |
| Liste à tirets | N tirets (réglable) | Réponse de chaque tiret |

## Utilisation

Ouvrez simplement `index.html` dans un navigateur (aucune installation, fonctionne hors ligne).

1. Renseignez le titre (et éventuellement matière, durée, consignes).
2. Ajoutez vos questions et remplissez les réponses.
3. Cliquez sur **Générer les PDF** : le sujet et le corrigé sont téléchargés.

Le travail est sauvegardé automatiquement dans le navigateur ; les boutons **Exporter / Importer** permettent de conserver un QCM dans un fichier `.json`.

## Technique

HTML/CSS/JS sans framework ; PDF générés avec [jsPDF](https://github.com/parallax/jsPDF) 2.5.1 (MIT), embarqué dans `vendor/`.
