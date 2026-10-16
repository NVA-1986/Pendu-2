# Analyse V2 — Pendu Schwiiz

**Date :** 2026-10-16  
**Méthode :** APEX — **A**touts, **P**roblèmes, **E**njeux, e**X**écution  
**Périmètre observé :** dépôt dans son état actuel, commit `d850ce8` (`fix(v1.1.9): désactiver cache static public`).

> Cette analyse remplace le constat de `ANALYSE-1.md`. Le projet n'est plus une simple spécification : un MVP fonctionnel, un backend public, un service admin et les scripts de déploiement sont maintenant présents.

---

## 1. Synthèse exécutive

Le projet a franchi un cap important : l'architecture prévue dans `PLAN-2.md` existe réellement.

- **Service public :** Express sur `0.0.0.0:4173`.
- **Service admin :** Express sur `127.0.0.1:4174` par défaut.
- **Frontend :** PWA Vanilla JS avec jeu, clavier, pendu SVG, thème clair/sombre et fallback hors ligne.
- **Données :** dictionnaire JSON administrable et SQLite pour les joueurs, sessions et statistiques agrégées.
- **Déploiement :** scripts d'installation/mise à jour et unités systemd générées.

Le projet est donc **techniquement jouable et déployable**, mais il n'est pas encore prêt à être considéré comme robuste en production. Le blocage fonctionnel immédiat est critique : `backend/data/words.json` contient actuellement **0 mot**. Une nouvelle installation démarre donc avec un dictionnaire vide et le jeu affiche une erreur de chargement tant qu'un administrateur n'a pas importé des mots.

Les risques les plus importants sont :

1. **Disponibilité produit :** dictionnaire vide dans le dépôt.
2. **Sécurité par défaut :** mot de passe admin `admin` et secret de session de développement codé en dur comme fallback.
3. **Intégrité des statistiques :** validation serveur trop permissive et absence de contrôle de cohérence entre le mot, son ID et la partie réellement jouée.
4. **XSS dans l'admin :** des valeurs du dictionnaire et des sessions sont injectées dans `innerHTML` sans échappement.
5. **Offline/PWA :** le cache Service Worker peut conserver un ancien dictionnaire et une ancienne version de l'application.
6. **Absence de tests automatisés :** le contrôle réalisé ici se limite à la syntaxe JavaScript et à l'inspection du dépôt.

**Verdict :** bonne base de MVP avancé, mais priorité à la remise en service du dictionnaire, au durcissement sécurité et aux tests avant exposition publique durable.

---

# 2. A — Atouts

## 2.1 Architecture et séparation des responsabilités

- Le découpage public/admin est concret et cohérent avec le plan V2.
- L'admin est bindé sur `127.0.0.1` par défaut, ce qui réduit fortement sa surface d'exposition réseau.
- Le frontend public et le frontend admin sont séparés.
- La logique de persistance est centralisée dans `backend/db/database.js`.
- Les routes publiques sont séparées (`routes/words.js`, `routes/stats.js`).
- Les endpoints de gestion du dictionnaire sont protégés par `requireAdmin`.

## 2.2 Fonctionnalités effectivement réalisées

Le parcours principal est largement couvert :

- nouvelle partie ;
- tirage aléatoire ;
- modes `FR_TO_DE` et `DE_TO_FR` ;
- clavier visuel A–Z et lettres spéciales ;
- prise en charge du clavier physique ;
- 7 erreurs et dessin SVG du pendu ;
- victoire, défaite et abandon ;
- durée et lettres essayées ;
- génération et conservation d'un identifiant joueur ;
- envoi ou mise en file des statistiques ;
- thème clair/sombre ;
- interface admin avec login, statistiques, CRUD, activation/désactivation, import et export.

## 2.3 Persistance et idempotence

La base SQLite est correctement initialisée avec :

- `journal_mode = WAL` ;
- clés étrangères activées ;
- index sur joueur et mot ;
- transaction lors de l'enregistrement d'une partie ;
- protection contre le double enregistrement via `game_sessions.id`.

La file IndexedDB possède également un index unique sur `session_id`, ce qui est une bonne base pour les retries offline.

## 2.4 Déploiement

Les scripts `scripts/install.sh` et `scripts/update.sh` montrent une volonté d'exploitation réelle :

- création d'un utilisateur système ;
- installation des dépendances natives nécessaires à `better-sqlite3` ;
- conservation du dictionnaire hors du dépôt ;
- lien symbolique vers le fichier de données persistant ;
- services systemd séparés ;
- génération d'un secret de session lors de l'installation ;
- redémarrage automatique des services.

## 2.5 Contrôles effectués

- La syntaxe des fichiers JavaScript backend et frontend est valide (`node --check`).
- Le dépôt est propre au moment de l'analyse.
- Les dépendances sont déclarées dans `package.json`.
- Le versioning applicatif est présent (`1.1.9`) et exposé via `/health` et `/config.js`.

---

# 3. P — Problèmes

## 3.1 Bloquant — dictionnaire vide

`backend/data/words.json` vaut actuellement `[]`.

Conséquences :

- `GET /api/words/random` retourne `404` (`No word available`) ;
- le fallback frontend charge aussi un tableau vide ;
- aucune partie ne peut démarrer ;
- l'admin affiche un dictionnaire vide jusqu'à import manuel.

Le script d'installation reproduit volontairement ce comportement si aucune sauvegarde de mots n'existe. Le dépôt ne fournit donc pas un état jouable immédiatement.

**Action :** fournir un corpus minimal versionné ou un fichier d'exemple clairement importable, puis ajouter une vérification de démarrage indiquant explicitement qu'aucun mot actif n'est disponible.

## 3.2 Sécurité — identifiants par défaut dangereux

Dans `backend/admin-auth.js` :

- mot de passe de secours : `admin` ;
- secret de session de secours : `dev-admin-secret`.

Le script d'installation définit également `ADMIN_PASSWORD=admin` par défaut. Même si l'admin écoute localhost par défaut, cette configuration est dangereuse dès qu'un tunnel, un proxy ou une modification du bind est utilisé.

Autres points :

- le cookie de login est créé avec `secure: false` en dur ;
- pas de limitation de tentatives sur `/api/auth/login` ;
- le mot de passe est comparé en clair à une variable d'environnement, sans hash ;
- aucune alerte ne force le remplacement des valeurs par défaut.

**Action :** refuser le démarrage en production si `ADMIN_PASSWORD` ou `ADMIN_SESSION_SECRET` sont absents/faibles, supprimer les fallbacks de production, activer `Secure` sous HTTPS, ajouter rate limiting et idéalement stocker un hash de mot de passe.

## 3.3 Sécurité — XSS possible dans l'interface admin

`frontend/admin/js/app.js` construit plusieurs tableaux avec `innerHTML` en y insérant directement des valeurs issues du dictionnaire ou de la base : `id`, `word`, `translation`, `hint`, `result`, etc.

Un mot importé contenant du HTML ou un script peut donc être exécuté dans l'admin lors du rendu. L'accès est privé, mais l'admin est précisément l'interface qui accepte des données importées et modifiées.

**Action :** échapper toutes les valeurs avant interpolation, ou construire les cellules avec `textContent` et des nœuds DOM. Ne pas considérer le caractère privé de l'admin comme une protection XSS suffisante.

## 3.4 Intégrité des statistiques insuffisamment protégée

`POST /api/stats` vérifie la forme générale du payload, mais pas suffisamment sa cohérence :

- `player_id`, `session_id` et `word_id` ne sont pas validés comme UUID/identifiants bornés ;
- aucune limite sur la taille des chaînes ou le nombre de lettres ;
- `errors` peut être supérieur à 7 ;
- `duration_seconds` peut être arbitrairement grand ;
- le serveur ne vérifie pas que `word_id` existe ;
- le serveur ne vérifie pas que `word` correspond au mot connu ;
- le serveur n'empêche pas une session `won` avec des valeurs incohérentes ;
- un client peut fabriquer des stats et gonfler la complexité.

L'idempotence par `session_id` est bonne, mais elle ne compense pas une validation métier faible.

**Action :** ajouter validation stricte (bornes, longueurs, enums), vérifier le mot connu côté serveur et plafonner les valeurs. Pour une protection forte, le serveur devrait émettre un jeton de partie ou vérifier un identifiant de partie distribué par l'API.

## 3.5 Contrat de données instable

La spécification initiale utilisait `word`, `translation`, `category`, `dialect`. Le code ajoute `deutch`, `hint`, `enabled`, `length`, et conserve le nom `deutch` qui semble être une faute de frappe de `deutsch`.

Le fallback dans `normalizeWordRecord` accepte même une entrée sans mot et fabrique `[mot manquant]`. Cette tolérance facilite l'import, mais peut créer des entrées impossibles à jouer.

**Action :** formaliser un schéma unique, renommer progressivement `deutch` en `deutsch` avec compatibilité de migration, refuser les mots sans réponse jouable et documenter précisément `length` (lettres ou caractères, espaces inclus ou non).

## 3.6 Offline et cache

Le Service Worker utilise `cacheFirst` pour les fichiers `.json`, dont `words.json`. Cela signifie qu'une ancienne version du dictionnaire peut rester utilisée après une modification admin ou une mise à jour serveur.

Le cache est invalidé uniquement si `CACHE_NAME` est changé manuellement (`v24`). La mise à jour est donc fragile : il faut penser à incrémenter ce nom à chaque livraison.

Le fallback frontend est utile, mais le cache-first peut servir une ancienne application dont le JavaScript ne correspond plus au HTML courant.

**Action :** versionner automatiquement le cache à chaque release, adopter une stratégie network-first pour le dictionnaire avec fallback cache, et prévoir une purge/mise à jour explicite après import admin.

## 3.7 Service Worker incomplet pour les erreurs d'initialisation

L'installation du Service Worker appelle `cache.addAll(APP_SHELL)`. Si une ressource est absente ou échoue, toute l'installation peut échouer. Ce risque est particulièrement sensible avec les chemins d'assets et les fichiers de configuration générés.

**Action :** vérifier chaque ressource du shell dans un test de déploiement et gérer les échecs de cache de façon contrôlée.

## 3.8 Qualité frontend

- Les styles et comportements ont été renforcés par beaucoup de styles inline et `!important`, signe que le CSS est devenu difficile à maintenir.
- Les touches correctes et incorrectes ont actuellement une apparence très proche/grise ; la différenciation fonctionnelle peut être insuffisante pour l'utilisateur.
- Le fichier `matomo.js` est référencé par le Service Worker mais le suivi principal est également injecté en inline dans `index.html` : la stratégie de tracking est à clarifier.
- Le mode hors ligne permet de jouer, mais l'utilisateur n'est pas informé de l'état de synchronisation des statistiques.
- La contrainte « tout tenir sans scroll » n'est pas démontrée par un test responsive automatisé.

## 3.9 Tests et observabilité

Il n'existe pas de script `test` dans `package.json`, ni de tests unitaires/intégration visibles.

Il manque notamment :

- tests du moteur de jeu ;
- tests des caractères accentués et des espaces/tirets ;
- tests API et SQLite ;
- test d'idempotence ;
- test import/export ;
- test offline/online ;
- test de bind réseau admin ;
- test de sécurité des entrées admin.

Les logs sont essentiellement des `console.log`/`console.error`, sans stratégie de rotation ou de corrélation par session.

---

# 4. E — Enjeux

## 4.1 Enjeu produit : redevenir jouable immédiatement

La priorité absolue n'est pas une nouvelle fonctionnalité. Il faut garantir qu'une installation propre dispose d'un dictionnaire valide ou d'un parcours d'initialisation clair.

Critère cible : après `npm install && npm start`, une partie doit être lançable sans manipulation admin préalable, au moins en environnement de démonstration.

## 4.2 Enjeu sécurité : protéger l'accès d'administration

L'admin touche au dictionnaire et aux données statistiques. Même lié à localhost, il doit être traité comme une surface sensible : tunnels SSH, reverse proxy, accès local compromis ou mauvaise configuration peuvent l'exposer.

La règle cible est :

- aucun secret par défaut ;
- aucune valeur HTML non échappée ;
- cookie sécurisé en production ;
- rate limiting login ;
- logs des opérations sensibles ;
- sauvegarde avant import/remplacement.

## 4.3 Enjeu qualité des données

Les statistiques servent à calculer la complexité des mots. Si le client peut déclarer librement n'importe quelle partie, le score devient peu fiable. Le projet doit choisir entre :

- télémétrie indicative, assumée comme non fiable ;
- statistiques protégées par un contrat serveur plus strict.

Pour l'usage admin prévu, la deuxième option est préférable.

## 4.4 Enjeu exploitation

Les données sont persistées hors dépôt via `WORDS_PATH`, mais la base SQLite reste dans `backend/db/hangman.db`. Il faut documenter et sauvegarder simultanément :

- le fichier JSON du dictionnaire ;
- la base SQLite ;
- les fichiers d'environnement systemd ;
- les versions déployées.

Il faut aussi vérifier que le compte système possède les droits nécessaires après mise à jour et que le lien symbolique n'est pas écrasé accidentellement.

## 4.5 Enjeu cohérence de version

Le projet contient plusieurs sources de vérité : version npm, version affichée dans le frontend, nom de cache Service Worker et contenu persistant externe. Une livraison doit mettre à jour ces éléments de manière coordonnée.

---

# 5. X — eXécution recommandée

## Phase 0 — Remise en état immédiate (bloquante)

1. Ajouter un corpus suisse-allemand validé dans `backend/data/words.json`, ou livrer un fichier de démonstration non vide.
2. Tester `GET /api/words/random?direction=FR_TO_DE` et `DE_TO_FR`.
3. Tester le démarrage avec dictionnaire vide et afficher une erreur utilisateur explicite plutôt qu'un écran ambigu.
4. Vérifier une partie complète : victoire, défaite, abandon, changement de direction.

## Phase 1 — Durcissement sécurité (priorité haute)

1. Supprimer les secrets par défaut en production.
2. Rendre obligatoire `ADMIN_PASSWORD` et `ADMIN_SESSION_SECRET` suffisamment longs.
3. Activer `Secure` pour le cookie derrière HTTPS.
4. Ajouter un rate limiting sur le login.
5. Échapper toutes les valeurs rendues dans les tableaux admin.
6. Ajouter des limites de taille et de valeur dans `POST /api/stats`.
7. Vérifier l'existence et la cohérence du `word_id` reçu.
8. Ajouter une politique de sauvegarde avant import avec `replace: true`.

## Phase 2 — Contrat de données et robustesse (priorité haute)

1. Documenter le schéma JSON réellement utilisé.
2. Corriger/migrer `deutch` vers `deutsch`.
3. Refuser les mots sans réponse et les entrées non jouables.
4. Définir si `length` compte les lettres uniquement ou tous les caractères.
5. Ajouter un endpoint ou une commande de validation du dictionnaire.
6. Ajouter une vérification au démarrage : nombre de mots total et nombre de mots actifs.

## Phase 3 — PWA/offline (priorité moyenne)

1. Automatiser l'incrément du nom de cache avec la version npm.
2. Passer `words.json` en network-first avec fallback cache.
3. Prévoir l'invalidation du dictionnaire après import admin.
4. Tester une mise à jour avec ancien Service Worker déjà installé.
5. Afficher éventuellement « statistiques en attente » sans exposer de dashboard joueur.

## Phase 4 — Tests automatisés (priorité moyenne à haute)

Ajouter un script `npm test` et couvrir au minimum :

- normalisation d'un mot ;
- mots activés/désactivés ;
- tirage aléatoire ;
- calcul de complexité ;
- enregistrement idempotent ;
- validation des stats ;
- import/export ;
- auth login/logout ;
- accès admin non authentifié ;
- parcours offline de la file IndexedDB si environnement navigateur disponible.

## Phase 5 — Exploitation et livraison

1. Ajouter une procédure de sauvegarde/restauration JSON + SQLite.
2. Ajouter une checklist de déploiement.
3. Vérifier firewall et reverse proxy : seul le public est exposé.
4. Vérifier `curl http://127.0.0.1:4174/health` depuis le serveur et l'impossibilité d'accès externe.
5. Documenter les variables : `PORT`, `HOST`, `WORDS_PATH`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`.
6. Définir une politique de rétention des sessions et de rotation des logs.

---

# 6. Score APEX de l'état actuel

| Domaine | Note | Commentaire |
|---|---:|---|
| Architecture | 8/10 | Découpage public/admin et persistance bien avancés |
| Fonctionnalités MVP | 8/10 | Parcours de jeu et admin largement présents |
| Données métier | 2/10 | Le schéma existe mais le dictionnaire livré est vide |
| Sécurité | 4/10 | Isolation localhost intéressante, secrets et XSS à corriger |
| Offline/PWA | 6/10 | Présent et fonctionnel en intention, cache trop manuel |
| Qualité de code | 6/10 | Code lisible, mais validation et CSS doivent être consolidés |
| Tests | 2/10 | Aucun dispositif automatisé identifié |
| Exploitabilité | 7/10 | Scripts systemd et données persistantes, sauvegardes à formaliser |

**Maturité globale estimée : 5,5/10 — MVP avancé, non durci pour production.**

---

# 7. Conclusion

Le projet est désormais une application réelle et non plus seulement une spécification. Le choix architectural est cohérent avec l'objectif : jeu public léger, administration privée, SQLite et PWA hors ligne.

Cependant, le dépôt actuel ne garantit pas encore une expérience immédiatement jouable car le dictionnaire est vide. Avant toute extension fonctionnelle, il faut traiter le socle : **données valides, secrets de production, échappement XSS, validation métier des statistiques, cache versionné et tests**.

Une fois ces six points corrigés, le projet pourra passer d'un MVP avancé à une première version exploitable avec un niveau de confiance raisonnable.
