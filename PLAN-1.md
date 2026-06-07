# Plan de réalisation détaillé — Pendu Suisse-Allemand (PWA simplifiée)

## 0. Objectif
Réaliser une **PWA mobile-first** jouable en une page, avec :
- gameplay du pendu,
- mots en suisse-allemand,
- bascule FR → DE-CH / DE-CH → FR,
- mode hors ligne,
- stats envoyées en arrière-plan,
- backend Node/Express + SQLite.

---

## 1. Principe d’exécution

### Ordre recommandé
1. Créer le socle projet.
2. Implémenter le jeu frontend sans backend.
3. Ajouter le backend et la persistance.
4. Ajouter le mode offline et la file de synchronisation.
5. Stabiliser, tester, puis finaliser la PWA.

### Règle de conduite
- Livrer d’abord un **MVP jouable**.
- Ajouter ensuite les couches de robustesse.
- Ne pas commencer par l’optimisation ou les stats avancées avant que le jeu fonctionne entièrement.

---

## 2. Phase 1 — Mise en place du socle projet

### 2.1 Arborescence
Créer la structure cible :
- `frontend/`
- `backend/`
- `backend/data/words.json`
- `backend/db/`
- `frontend/css/`
- `frontend/js/`
- `frontend/assets/icons/`

### 2.2 Base technique
- Initialiser le projet Node.js.
- Ajouter Express.
- Préparer la configuration de lancement local.
- Définir les scripts de démarrage.

### 2.3 Livrables
- projet lançable localement,
- structure claire,
- conventions de nommage établies.

### 2.4 Critère de fin
- le serveur démarre,
- la page front est servie,
- la structure est prête pour le développement fonctionnel.

---

## 3. Phase 2 — Modèle de données et source des mots

### 3.1 Définir le format de `words.json`
Valider un schéma stable :
- `id`
- `word`
- `translation`
- `category?`
- `dialect?`

### 3.2 Préparer un jeu de test
Créer un petit corpus initial varié :
- mots courts,
- mots longs,
- mots avec accents,
- mots avec espaces/tirets,
- cas difficiles.

### 3.3 Côté backend
- implémenter le chargement des mots,
- exposer `/api/words/random`.

### 3.4 Critère de fin
- un mot aléatoire peut être récupéré,
- le format est constant,
- les cas spéciaux sont représentés dans les données.

---

## 4. Phase 3 — Moteur du jeu frontend

### 4.1 Structure UI
Construire la page unique avec :
- titre,
- actions,
- indice,
- pendu SVG,
- mot masqué,
- clavier visuel.

### 4.2 Logique centrale
Implémenter :
- démarrage d’une partie,
- sélection du mot,
- affichage de l’indice,
- suivi des lettres tentées,
- gestion des erreurs,
- victoire/défaite,
- réinitialisation.

### 4.3 Règles à figer
- lettres accentuées distinctes,
- espaces/tirets révélés automatiquement,
- 7 erreurs max,
- état visuel des touches.

### 4.4 Critère de fin
- une partie complète est jouable sans backend de stats,
- le joueur peut gagner ou perdre,
- l’interface réagit correctement.

---

## 5. Phase 4 — Clavier visuel et saisie physique

### 5.1 Clavier visuel
- A à Z,
- lettres spéciales : `Ä Ö Ü É À È`,
- états : default / correct / wrong / disabled.

### 5.2 Saisie physique
- capter `keydown`,
- mapper la touche vers la lettre du jeu,
- synchroniser la mise en évidence visuelle.

### 5.3 Gestion des collisions
- ignorer les lettres déjà jouées,
- empêcher les doubles comptages,
- normaliser les entrées non supportées.

### 5.4 Critère de fin
- clavier écran et clavier physique produisent le même résultat,
- la saisie est fiable sur desktop et mobile.

---

## 6. Phase 5 — Pendu SVG et feedback visuel

### 6.1 Dessin du pendu
Créer un SVG en étapes :
1. potence,
2. tête,
3. corps,
4. bras gauche,
5. bras droit,
6. jambe gauche,
7. jambe droite.

### 6.2 Animation légère
- apparition progressive,
- transitions simples,
- compatibilité mobile.

### 6.3 Critère de fin
- chaque erreur fait évoluer visuellement le pendu,
- l’état final de défaite est clair.

---

## 7. Phase 6 — Backend stats + SQLite

### 7.1 Base SQLite
Créer :
- `players`
- `game_sessions`
- `word_stats`

### 7.2 Endpoints
- `POST /api/player`
- `POST /api/stats`

### 7.3 Règles serveur
- validation des payloads,
- insertion transactionnelle,
- mise à jour des agrégats,
- gestion anti-doublon via `session_id`.

### 7.4 Critère de fin
- une partie terminée peut être enregistrée,
- les stats sont cohérentes,
- le backend tolère les retries sans duplication.

---

## 8. Phase 7 — Intégration des stats côté frontend

### 8.1 Collecte locale
Conserver en mémoire les informations de partie :
- session_id,
- player_id,
- word_id,
- mot,
- direction,
- résultat,
- erreurs,
- lettres tentées,
- durée.

### 8.2 Envoi au backend
- envoyer à la fin de partie,
- gérer les erreurs réseau,
- préparer la mise en file offline.

### 8.3 Critère de fin
- chaque fin de partie déclenche un envoi ou une mise en attente,
- la structure des données correspond à l’API.

---

## 9. Phase 8 — Mode hors ligne et synchronisation

### 9.1 Service Worker
Mettre en cache :
- HTML,
- CSS,
- JS,
- icônes,
- `words.json`.

### 9.2 Stratégies de cache
- cache-first pour les assets statiques,
- stratégie adaptée pour `words.json`,
- éviter un cache naïf pour une ressource aléatoire si cela fausse le jeu.

### 9.3 IndexedDB
Créer une file `pending_stats` pour :
- stocker les stats en attente,
- rejouer les envois dans l’ordre,
- supprimer les éléments une fois confirmés.

### 9.4 Synchronisation
- déclenchement à `online`,
- retry au démarrage,
- reprise en cas d’échec partiel.

### 9.5 Critère de fin
- le jeu reste utilisable hors ligne,
- les stats s’alignent dès le retour réseau.

---

## 10. Phase 9 — PWA complète

### 10.1 Manifest
Créer :
- nom,
- short_name,
- theme_color,
- background_color,
- orientation,
- icônes.

### 10.2 Installabilité
- vérification du `start_url`,
- affichage standalone,
- test d’installation sur mobile.

### 10.3 Critère de fin
- l’application est installable,
- l’expérience ressemble à une vraie app.

---

## 11. Phase 10 — Responsive, accessibilité et finition UI

### 11.1 Responsive mobile-first
- tailles de boutons adaptées,
- pas de débordement,
- lisibilité des lettres,
- mot adaptable à la largeur.

### 11.2 Accessibilité minimale
- libellés explicites,
- contraste suffisant,
- focus visible,
- navigation clavier.

### 11.3 Critère de fin
- l’interface reste utilisable sur petit écran,
- l’expérience est stable sur plusieurs tailles d’écran.

---

## 12. Phase 11 — Tests et validation

### 12.1 Tests fonctionnels
Vérifier :
- tirage aléatoire,
- victoire,
- défaite,
- lettres répétées,
- lettres accentuées,
- mots avec espaces/tirets.

### 12.2 Tests techniques
- appel API,
- persistance SQLite,
- offline/online,
- rejouabilité des stats,
- rechargement de page.

### 12.3 Tests UX
- lisibilité mobile,
- taille des touches,
- clarté des états visuels.

### 12.4 Critère de fin
- aucun bug bloquant sur le parcours principal,
- comportement stable en mode hors ligne et en ligne.

---

## 13. Phase 12 — Stabilisation et livraison

### 13.1 Nettoyage
- supprimer le code mort,
- centraliser les constantes,
- documenter les choix clés.

### 13.2 Documentation
Préparer :
- installation locale,
- lancement,
- structure du projet,
- format des données,
- limites connues.

### 13.3 Livrable final
- application jouable,
- PWA installable,
- backend fonctionnel,
- stats persistées,
- offline opérationnel.

---

## 14. Priorisation synthétique

### Niveau 1 — indispensable
- structure projet,
- chargement des mots,
- logique de jeu,
- UI principale.

### Niveau 2 — important
- backend,
- SQLite,
- stats,
- anti-doublon.

### Niveau 3 — différenciant
- offline,
- IndexedDB,
- service worker,
- installabilité PWA.

### Niveau 4 — qualité
- tests,
- accessibilité,
- polish UI,
- documentation.

---

## 15. Définition du succès
Le projet est considéré terminé lorsque :
- on peut jouer entièrement au pendu sur mobile,
- le jeu fonctionne avec ou sans connexion,
- les stats sont envoyées correctement,
- l’application est installable comme PWA,
- le code est organisé et maintenable.
