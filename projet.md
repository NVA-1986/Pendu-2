# 📋 Spécification Technique — Jeu de Pendu Suisse-Allemand (PWA Simplifiée)

> Version simplifiée — Une seule page de jeu, mobile-first, offline-capable, avec collecte de stats en arrière-plan.

---

## 🎯 Vue d'ensemble

| Propriété       | Valeur                                          |
|-----------------|-------------------------------------------------|
| Type            | Progressive Web App (PWA) mobile-first          |
| Thème           | Jeu de pendu — mots en suisse-allemand          |
| Pages           | **Une seule page de jeu**                       |
| Stockage stats  | SQLite (backend) + IndexedDB (offline queue)    |
| Source des mots | `./data/words.json`                             |
| Langue UI       | Français                                        |

---

## 🚫 Hors Scope (simplifié volontairement)

- ❌ Système de compte / inscription / connexion
- ❌ Classement / leaderboard
- ❌ Profil joueur
- ❌ Dashboard statistiques visible par le joueur
- ❌ Import XLSX (words.json déjà fourni)
- ❌ Mode multijoueur

---

## 🏗️ Architecture des Fichiers

```
/project-root
│
├── /frontend
│   ├── index.html               # Page unique du jeu
│   ├── manifest.json            # Config PWA
│   ├── service-worker.js        # Offline support
│   ├── /css
│   │   └── style.css            # Styles responsive mobile-first
│   ├── /js
│   │   ├── app.js               # Logique principale du jeu
│   │   ├── hangman.js           # Dessin SVG du pendu
│   │   ├── keyboard.js          # Clavier visuel A-Z + lettres spéciales
│   │   ├── words.js             # Chargement et gestion des mots
│   │   └── stats-sync.js        # Envoi des stats (online/offline queue)
│   └── /assets
│       └── icons/               # Icônes PWA (192x192, 512x512)
│
├── /backend
│   ├── server.js                # Serveur Express (Node.js)
│   ├── /routes
│   │   ├── words.js             # GET /api/words/random
│   │   └── stats.js             # POST /api/stats
│   ├── /db
│   │   ├── database.js          # Init SQLite + schéma
│   │   └── hangman.db           # Fichier SQLite (auto-généré)
│   └── /data
│       └── words.json           # Source des mots (fourni)
│
└── README.md
```

---

## 🖥️ Stack Technique

| Couche     | Technologie                        |
|------------|------------------------------------|
| Frontend   | Vanilla JS (pas de framework)      |
| PWA        | Service Worker natif               |
| Backend    | Node.js + Express                  |
| Base de données | SQLite via `better-sqlite3`   |
| Offline queue | IndexedDB (idb-keyval ou natif)|
| Déploiement | VPS, Render, Railway ou autre     |

---

## 🎮 Page de Jeu — Éléments UI

La page unique contient **dans l'ordre vertical** :

```
┌─────────────────────────────────┐
│        🪢 Pendu Schwiiz         │  ← Titre
├─────────────────────────────────┤
│  [🔄 Nouvelle Partie]  [FR⇄DE] │  ← Boutons actions
├─────────────────────────────────┤
│    Indice : "Dîner" (FR)        │  ← Mot indice (langue opposée)
├─────────────────────────────────┤
│         [SVG Pendu]             │  ← Dessin pendu (7 étapes)
├─────────────────────────────────┤
│      _ _ _ _ _ _               │  ← Lettres à trouver
├─────────────────────────────────┤
│  A B C D E F G H I J K L M    │
│  N O P Q R S T U V W X Y Z    │  ← Clavier visuel
│        Ä Ö Ü É À È            │  ← Lettres spéciales
└─────────────────────────────────┘
```

### Détail des éléments

#### Titre
- Texte fixe : `Pendu Schwiiz` (ou équivalent choisi)
- Affiché en haut de page, centré

#### Bouton "Nouvelle Partie"
- Réinitialise complètement la partie en cours
- Sélectionne un nouveau mot aléatoire depuis `words.json`
- Remet le pendu à l'état initial
- Remet toutes les touches du clavier à l'état `default`

#### Bouton "FR ⇄ DE-CH" (sens du jeu)
- **Mode FR → DE-CH** *(défaut)* : L'indice affiché est le mot en **français**, le joueur doit deviner le mot en **suisse-allemand**
- **Mode DE-CH → FR** : L'indice affiché est le mot en **suisse-allemand**, le joueur doit deviner la **traduction française**
- Le bouton affiche le mode actif et bascule entre les deux
- Déclenche automatiquement une nouvelle partie

#### Mot Indice
- Affiché sous les boutons, centré
- Libellé : `Indice : "[mot]"`
- Langue affichée = langue opposée au mot à deviner

#### Dessin du Pendu (SVG)
- Dessin SVG inline, 7 étapes d'erreurs
- Chaque élément du pendu est un `<path>` ou `<g>` avec `display: none` par défaut
- À chaque erreur, l'élément suivant devient visible (transition CSS `opacity` ou `stroke-dashoffset`)
- **Étapes** :
  1. Potence (structure fixe, toujours visible)
  2. Tête
  3. Corps
  4. Bras gauche
  5. Bras droit
  6. Jambe gauche
  7. Jambe droite → **GAME OVER**

#### Affichage du Mot (`_ _ _ _`)
- Un tiret par lettre, séparés par des espaces
- Les lettres trouvées remplacent les tirets correspondants
- Fonte monospace, grande taille, centrée
- En cas de victoire : affichage du mot complet en vert
- En cas de défaite : révélation du mot en rouge

#### Clavier Visuel
- Disposition : **ordre alphabétique** (A → Z)
- Rangée supplémentaire pour les lettres spéciales : `Ä Ö Ü É À È`
- **États des touches** :

| État       | Style visuel                          |
|------------|---------------------------------------|
| `default`  | Fond blanc, bordure grise             |
| `correct`  | Fond vert, texte blanc                |
| `wrong`    | Fond gris foncé, texte blanc          |
| `disabled` | Opacité 50%, non cliquable            |

- Écoute également les événements `keydown` du clavier physique
- Synchronisation visuelle : la touche pressée au clavier physique est mise en surbrillance sur le clavier visuel

---

## 🎲 Logique de Jeu

### Déroulement d'une partie

1. Sélection aléatoire d'un mot depuis `words.json`
2. Affichage de l'indice (mot dans la langue opposée)
3. Affichage des tirets `_` (un par lettre)
4. Le joueur clique sur une lettre (ou appuie sur le clavier)
5. **Si la lettre est dans le mot** : les tirets correspondants sont remplacés → touche marquée `correct`
6. **Si la lettre n'est pas dans le mot** : compteur d'erreurs +1, dessin du pendu avancé → touche marquée `wrong`
7. **Victoire** : toutes les lettres trouvées → message de victoire + stats enregistrées
8. **Défaite** : 7 erreurs atteintes → mot révélé + message de défaite + stats enregistrées

### Règles supplémentaires
- Les lettres accentuées et non accentuées sont **distinctes** (ä ≠ a)
- Les espaces et tirets dans un mot sont **révélés automatiquement** (non à deviner)
- Maximum d'erreurs : **7**

---

## 📊 Système de Statistiques (Arrière-plan)

Les stats sont **invisibles pour le joueur** mais collectées pour analyse future.

### Schéma SQLite

#### Table `players`
```sql
CREATE TABLE players (
  id TEXT PRIMARY KEY,          -- UUID généré à la première visite (localStorage)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME
);
```

#### Table `game_sessions`
```sql
CREATE TABLE game_sessions (
  id TEXT PRIMARY KEY,           -- UUID de la session
  player_id TEXT,                -- Référence player
  word TEXT,                     -- Mot à deviner
  word_id TEXT,                  -- ID du mot dans words.json
  direction TEXT,                -- 'FR_TO_DE' ou 'DE_TO_FR'
  result TEXT,                   -- 'won', 'lost', 'abandoned'
  errors INTEGER,                -- Nombre d'erreurs commises
  letters_tried TEXT,            -- JSON array des lettres essayées
  duration_seconds INTEGER,      -- Durée de la partie
  hint_used INTEGER DEFAULT 0,   -- 0 ou 1
  played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id)
);
```

#### Table `word_stats`
```sql
CREATE TABLE word_stats (
  word_id TEXT PRIMARY KEY,
  play_count INTEGER DEFAULT 0,
  win_count INTEGER DEFAULT 0,
  lose_count INTEGER DEFAULT 0,
  abandon_count INTEGER DEFAULT 0,
  total_errors INTEGER DEFAULT 0,
  total_duration INTEGER DEFAULT 0,
  complexity_score REAL DEFAULT 0,
  complexity_label TEXT DEFAULT 'moyen',
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Formule de Complexité (calculée à chaque fin de partie)

```
success_rate  = win_count / play_count
avg_errors    = total_errors / play_count
abandon_rate  = abandon_count / play_count

complexity_score = (1 - success_rate) * 50
                 + (avg_errors / 7) * 30
                 + abandon_rate * 20

complexity_label :
  0  – 25  → "facile"
  25 – 50  → "moyen"
  50 – 75  → "difficile"
  75 – 100 → "très difficile"
```

---

## 🔌 API REST

| Méthode | Route              | Description                                         |
|---------|--------------------|-----------------------------------------------------|
| GET     | `/api/words/random`| Retourne un mot aléatoire depuis `words.json`       |
| POST    | `/api/stats`       | Enregistre les stats d'une partie terminée          |
| POST    | `/api/player`      | Crée ou met à jour un joueur (UUID)                 |

### POST `/api/stats` — Body attendu

```json
{
  "session_id": "uuid",
  "player_id": "uuid",
  "word_id": "word_042",
  "word": "Znacht",
  "direction": "FR_TO_DE",
  "result": "won",
  "errors": 3,
  "letters_tried": ["a", "e", "z", "n", "c", "h", "t"],
  "duration_seconds": 47
}
```

---

## 📶 Mode Hors Ligne (Offline)

### Service Worker
- **Cache statique** (Cache First) : HTML, CSS, JS, SVG pendu, icônes
- **Cache des mots** : `words.json` mis en cache au premier chargement
- **API stats** : si hors ligne, la requête est mise en attente

### File d'attente offline (IndexedDB)
- À chaque fin de partie, les stats sont d'abord écrites dans **IndexedDB** (`pending_stats` store)
- Un listener `online` surveille le retour de la connexion
- Dès que la connexion revient : les stats en attente sont envoyées au backend **dans l'ordre**, puis supprimées de la file

```js
// Flux simplifié
window.addEventListener('online', async () => {
  const pending = await getAllPendingStats(); // depuis IndexedDB
  for (const stat of pending) {
    await fetch('/api/stats', { method: 'POST', body: JSON.stringify(stat) });
    await removePendingStat(stat.session_id);
  }
});
```

### Stratégie de cache

| Ressource              | Stratégie      |
|------------------------|----------------|
| HTML / CSS / JS        | Cache First    |
| `words.json`           | Cache First    |
| `/api/words/random`    | Cache First    |
| `/api/stats` (POST)    | Queue offline  |

---

## 📱 PWA — Configuration `manifest.json`

```json
{
  "name": "Pendu Schwiiz",
  "short_name": "Pendu CH",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#D32F2F",
  "icons": [
    { "src": "/assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## 📐 Responsive / Mobile-First

- Breakpoints : mobile (≤ 480px), tablette (481–768px), desktop (> 768px)
- Le clavier visuel doit être **utilisable avec le pouce** (taille min des touches : 44×44px)
- Le SVG du pendu est scalable (viewBox défini, width: 100%)
- Les tirets du mot s'adaptent à la largeur de l'écran (font-size fluide ou scroll horizontal)
- Pas de scroll vertical nécessaire sur mobile standard (tout tient dans le viewport)

---

## 🚀 Priorités de Développement

1. ✅ Chargement et affichage des mots depuis `words.json`
2. ✅ Logique de jeu core (lettres, erreurs, victoire/défaite)
3. ✅ Dessin SVG du pendu (7 étapes animées)
4. ✅ Clavier visuel A-Z + lettres spéciales + keydown physique
5. ✅ Bouton sens FR ⇄ DE-CH
6. ✅ Génération UUID joueur + stockage localStorage
7. ✅ Backend Express + SQLite (tables + endpoints)
8. ✅ Envoi des stats après chaque partie
9. ✅ Service Worker + cache offline
10. ✅ File d'attente IndexedDB + synchronisation au retour en ligne
11. ✅ PWA manifest + icônes installables

---

## 📁 Structure de `words.json` attendue

```json
[
  {
    "id": "word_001",
    "word": "Znacht",
    "translation": "Dîner",
    "category": "Alimentation",
    "dialect": "Zürichdeutsch"
  }
]
```

> Les champs `category` et `dialect` sont optionnels mais conservés pour usage futur.

---

*Document version 2.0 — Simplifié pour développement agent IA*
*Scope : une page de jeu, offline-capable, stats SQLite en arrière-plan.*
