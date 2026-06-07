# Analyse approfondie du projet — Pendu Suisse-Allemand (PWA simplifiée)

## 1. Constat initial

Le dépôt est, à ce stade, **quasi vide côté implémentation** :
- un seul document de spécification est présent (`projet.md`),
- aucun code frontend, backend, base de données, manifest, service worker ou jeu de mots n’est encore fourni.

👉 Conclusion importante : **le projet est défini, mais non réalisé**. L’analyse porte donc sur la qualité de la spécification, l’architecture cible, les dépendances fonctionnelles, les risques, et les points à clarifier avant développement.

---

## 2. Résumé fonctionnel

Le projet vise une **PWA mobile-first d’un jeu du pendu** en suisse-allemand, avec :
- **une seule page de jeu**,
- **mode hors ligne**,
- **clavier visuel + saisie physique**, 
- **statistiques invisibles pour le joueur**, stockées en arrière-plan,
- **backend Node/Express + SQLite**,
- **source de mots JSON**,
- **bascule de sens de traduction** :
  - FR → DE-CH,
  - DE-CH → FR.

Le scope est volontairement réduit et cohérent : pas de compte, pas de leaderboard, pas de multijoueur, pas de dashboard joueur.

---

## 3. Lecture de l’architecture cible

### 3.1 Frontend
Le frontend prévu est simple et adapté au contexte :
- **Vanilla JS** : bon choix pour limiter la complexité,
- **une page unique** : cohérente pour un jeu mobile,
- **SVG pour le pendu** : performant, léger, facile à animer,
- **Service Worker** : indispensable pour le mode hors ligne,
- **IndexedDB** : approprié pour la file d’attente offline.

### 3.2 Backend
Le backend est minimal mais structurant :
- `GET /api/words/random`
- `POST /api/stats`
- `POST /api/player`

L’usage de **SQLite** est pertinent pour un jeu léger avec statistiques locales et faible volumétrie.

### 3.3 Données
Deux sources de données sont prévues :
- `words.json` comme catalogue de jeu,
- SQLite comme persistance des stats.

Cela sépare bien le contenu “jeu” (mots) et la télémétrie (stats).

---

## 4. Analyse de la logique de jeu

### 4.1 Boucle principale
La séquence décrite est saine :
1. tirage d’un mot,
2. affichage de l’indice,
3. saisie d’une lettre,
4. vérification,
5. mise à jour de l’état,
6. victoire ou défaite,
7. enregistrement des stats.

C’est une boucle simple et robuste pour une implémentation sans framework.

### 4.2 Règles de jeu
Points positifs :
- gestion des caractères accentués et spécifiques,
- auto-révélation des espaces et tirets,
- maximum d’erreurs fixé à 7,
- conservation de l’état visuel des touches.

Points sensibles :
- la distinction stricte entre lettres accentuées et non accentuées peut poser des problèmes UX sur clavier physique mobile/desktop,
- il faut définir précisément le comportement de normalisation (ex. `é` vs `e`) car le document dit que les lettres sont distinctes, ce qui peut être intentionnel mais doit être assumé partout.

### 4.3 Clavier visuel
Le clavier A-Z + lettres spéciales est cohérent, mais il implique :
- un mapping clavier physique/visuel non trivial,
- une prise en charge des touches non QWERTY/azerty,
- une logique de désactivation des lettres déjà jouées.

---

## 5. Analyse de la structure des données

### 5.1 `words.json`
Le schéma proposé est suffisant :
- `id`
- `word`
- `translation`
- `category` (optionnel)
- `dialect` (optionnel)

Observations :
- la présence d’un `id` est très utile pour les stats,
- le choix d’un JSON est simple et pratique,
- la qualité de l’expérience dépendra de la qualité lexicale du fichier source.

### 5.2 SQLite
Le schéma des stats est bien orienté analytique :
- `players` : identifiant pseudonyme,
- `game_sessions` : journal des parties,
- `word_stats` : agrégats par mot.

#### Point fort
Le modèle permet d’analyser :
- taux de victoire,
- difficulté par mot,
- fréquence de jeu,
- durée moyenne,
- comportement d’abandon.

#### Point de vigilance
Le schéma semble conçu pour des agrégations incrémentales, mais il manque :
- la stratégie de mise à jour transactionnelle,
- la gestion des doublons d’envoi de stats,
- la clé d’idempotence côté backend.

Sans cela, une synchronisation offline peut produire des doublons si une requête est rejouée.

---

## 6. Analyse offline / PWA

Le volet offline est l’un des points les plus importants du projet.

### 6.1 Ce qui est bien pensé
- cache des assets statiques,
- cache du fichier de mots,
- file d’attente IndexedDB pour les stats,
- synchronisation à la reconnexion.

### 6.2 Risques techniques
1. **Stratégie de cache trop simplifiée**
   - `Cache First` sur `/api/words/random` est discutable : une API aléatoire cache-first peut renvoyer une réponse périmée ou répétée.
   - Pour un endpoint random, il faut probablement une logique plus nuancée.

2. **Synchronisation à l’online event insuffisante seule**
   - `online` n’est pas toujours fiable comme unique déclencheur.
   - Un retry périodique ou au démarrage serait plus robuste.

3. **Ordre et idempotence**
   - la file doit garantir l’ordre d’envoi,
   - le backend doit ignorer les doublons via `session_id`.

4. **Service Worker et versioning**
   - aucune stratégie de version d’assets n’est décrite,
   - il faudra prévoir invalidation / mise à jour du cache.

---

## 7. Analyse UX/UI

### 7.1 Forces
- interface minimaliste adaptée au mobile,
- gros boutons, bon pour le pouce,
- un seul écran, donc faible friction,
- feedback visuel clair (clavier + pendu + mot).

### 7.2 Fragilités
- le texte et les accents peuvent poser des soucis de lisibilité sur petits écrans,
- la contrainte “pas de scroll vertical” est ambitieuse : elle dépend fortement de la longueur des mots, de la taille du clavier et de la hauteur disponible,
- la mise en page doit être très soignée pour éviter toute compression excessive.

### 7.3 Accessibilité
Le document ne couvre pas suffisamment :
- aria-labels,
- navigation clavier complète,
- contraste de couleurs,
- support lecteurs d’écran,
- retour haptique éventuel sur mobile.

C’est un angle important si le projet veut être durable.

---

## 8. Analyse de la complexité et du calcul de score

La formule de complexité est simple et lisible :
- succès = facteur principal,
- erreurs = facteur secondaire,
- abandons = pénalité.

### Avantages
- interprétable,
- facile à recalculer,
- utile pour trier les mots.

### Limites
- la complexité dépend aussi de la longueur du mot,
- la présence de lettres rares/accents n’est pas prise en compte,
- le nombre de joueurs sur un mot peut rendre le score instable au début.

👉 Il faudrait probablement un **minimum de parties** avant de considérer un score fiable.

---

## 9. Qualité de la spécification

### Points forts
- scope très clair,
- architecture bien découpée,
- endpoints précis,
- modèle de données explicite,
- priorité de développement logique.

### Points incomplets / ambiguës
1. **Aucune contrainte sur le format exact de `words.json` au-delà d’un exemple**.
2. **Règles de normalisation des lettres** insuffisamment formalisées.
3. **Comportement exact en cas de mot contenant des espaces/tirets** non détaillé dans la logique d’input.
4. **Gestion des sessions abandonnées** : quand un abandon est-il enregistré ? à la fermeture ? au nouveau mot ? au rafraîchissement ?
5. **Auth / sécurité** inexistantes (ce qui est acceptable pour un projet simple), mais les endpoints devront quand même éviter les écritures incohérentes.
6. **Aucune stratégie de migration DB**.
7. **Aucune stratégie de tests**.

---

## 10. Risques projet

### Risque 1 — Sous-estimation de l’offline
Le couple Service Worker + IndexedDB + synchronisation backend est le principal risque technique.

### Risque 2 — Données incohérentes
Sans idempotence et validation serveur, les stats peuvent être faussées.

### Risque 3 — UX mobile trop serrée
Le “tout tenir dans le viewport” peut être difficile selon la taille des mots.

### Risque 4 — Internationalisation / accents
Les lettres spéciales doivent être traitées de façon cohérente côté affichage, saisie et statistiques.

### Risque 5 — Absence de structure de projet réelle
Comme le dépôt est vide, il faut définir proprement l’arborescence, le build/run local, et les conventions avant de coder.

---

## 11. Recommandations techniques

### Priorité A — socle minimal
- créer l’arborescence réelle,
- implémenter le chargement des mots,
- mettre en place la boucle de jeu,
- afficher le clavier et le pendu,
- valider la logique de victoire/défaite.

### Priorité B — robustesse
- ajouter le backend Express,
- créer les tables SQLite,
- valider les payloads API,
- rendre `POST /api/stats` idempotent,
- enregistrer les sessions proprement.

### Priorité C — offline
- service worker versionné,
- cache des assets,
- IndexedDB pour la queue,
- synchronisation au retour en ligne + retry.

### Priorité D — qualité
- tests unitaires sur la logique de mot,
- tests d’intégration API,
- vérification responsive,
- accessibilité minimale.

---

## 12. Proposition de structure d’implémentation

Si l’on passe de la spec au code, la structure suivante semble rationnelle :
- `frontend/`
  - `index.html`
  - `css/style.css`
  - `js/app.js`
  - `js/words.js`
  - `js/keyboard.js`
  - `js/hangman.js`
  - `js/stats-sync.js`
  - `service-worker.js`
- `backend/`
  - `server.js`
  - `routes/words.js`
  - `routes/stats.js`
  - `db/database.js`
  - `data/words.json`

Cette séparation est claire et maintenable.

---

## 13. Verdict global

Le projet est **bien cadré conceptuellement** et présente une **bonne base pour un MVP solide**.

### Appréciation
- **Clarté fonctionnelle : élevée**
- **Simplicité de réalisation : moyenne**
- **Complexité technique réelle : moyenne à élevée** à cause de l’offline et de la synchronisation
- **Risque principal : cohérence des données hors ligne**

### Verdict
C’est un **bon projet de jeu léger**, mais il faut traiter avec rigueur :
- l’idempotence des stats,
- la gestion offline,
- les règles de saisie des lettres,
- la compatibilité mobile.

---

## 14. Conclusion

En l’état, le projet est une **spécification solide mais non implémentée**. Le succès dépendra moins de la complexité du gameplay que de la qualité de l’architecture offline et de la gestion des données.

Le chemin le plus sûr consiste à réaliser un MVP jouable d’abord, puis à ajouter la couche backend/stats/offline avec des contrats API et un stockage local robustes.
