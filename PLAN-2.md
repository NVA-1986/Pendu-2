# Plan V2 — Pendu public + Admin privé sur 1 seul LXC

## Objectif
Séparer le projet en **2 services** sur **2 ports** dans un seul LXC Debian :
- **Service 1 : Pendu public**
  - port `4173`
  - accessible via Cloudflare/ZT
- **Service 2 : Admin privé**
  - port `4174`
  - bind `127.0.0.1` uniquement
  - accessible seulement localement (ou via tunnel/SSH si nécessaire)

Objectif sécurité : **aucun accès direct depuis Internet** vers l’admin.

---

## 1. Architecture cible

### 1.1 Service public
Responsabilités :
- afficher le jeu,
- charger les mots,
- envoyer les stats en fin de partie,
- rester simple et rapide.

### 1.2 Service admin
Responsabilités :
- page de login,
- page statistiques,
- page de gestion du dictionnaire,
- accès aux données SQLite,
- CRUD sur les mots,
- consultation des stats agrégées.

### 1.3 Stockage
- une **SQLite de stats** pour les parties jouées,
- une **SQLite ou table dédiée** pour le dictionnaire (recommandé pour V2),
- éventuellement un export/import JSON si besoin de migration.

---

## 2. Découpage technique

### 2.1 Deux applications Node séparées
- `public` → `backend/public-server.js`
- `admin` → `backend/admin-server.js`

Chaque app aura :
- sa config,
- ses routes,
- ses fichiers statiques,
- son service systemd.

### 2.2 Ports
- public : `4173`
- admin : `4174`

### 2.3 Bind réseau
- public : `0.0.0.0:4173`
- admin : `127.0.0.1:4174`

---

## 3. Pages admin

### 3.1 Login
Fonctions :
- authentification simple,
- création de session admin,
- protection des routes admin.

### 3.2 Stats
Fonctions :
- vue globale,
- stats par mot,
- stats par période,
- filtres simples,
- export CSV éventuel.

### 3.3 Dictionnaire
Fonctions :
- liste des mots,
- ajout,
- modification,
- suppression,
- recherche par mot/region/hint/catégorie,
- import/export éventuel.

---

## 4. Sécurité

### 4.1 Isolation réseau
- admin uniquement sur `localhost`,
- pas de reverse proxy public vers le port `4174`,
- firewall autorisant seulement le nécessaire.

### 4.2 Auth
- mot de passe admin,
- cookie de session ou token signé,
- routes protégées côté serveur.

### 4.3 Accès aux données
- le backend admin lit/écrit la DB,
- le service public ne fait que lire les mots et écrire les stats.

---

## 5. Organisation du code

### 5.1 Arborescence suggérée
- `backend/public/`
- `backend/admin/`
- `backend/db/`
- `backend/data/`
- `frontend/public/`
- `frontend/admin/`
- `scripts/`

### 5.2 Réutilisation
Réutiliser :
- la logique SQLite,
- la validation des données,
- les helpers de mots,
- le style de base.

---

## 6. Étapes de réalisation

### Phase A — base infra
- créer la branche V2,
- séparer les services,
- ajouter les scripts de lancement,
- vérifier les ports,
- vérifier le bind localhost de l’admin.

### Phase B — admin login
- page de login,
- création de session,
- protection middleware.

### Phase C — stats
- pages de stats,
- endpoints admin de lecture,
- affichage des agrégats.

### Phase D — dictionnaire
- CRUD mots,
- stockage structuré,
- validation serveur.

### Phase E — durcissement
- tests,
- logs,
- sauvegarde DB,
- vérification qu’aucun accès externe ne touche l’admin.

---

## 7. Critères de réussite
- le jeu public continue de fonctionner,
- l’admin est accessible uniquement en local,
- les stats sont visibles dans l’admin,
- le dictionnaire est gérable depuis l’admin,
- aucune route admin n’est exposée à Internet.

---

## 8. Recommandation finale
Pour V2, garder le plus possible le public stable et déplacer la complexité dans l’admin.
Le meilleur compromis est :
- **public minimal**,
- **admin complet**,
- **un seul LXC**, mais **deux services strictement séparés**.
