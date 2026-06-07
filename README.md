# Pendu Schwiiz

PWA simplifiée du jeu du pendu en suisse-allemand.

## Lancer le projet

```bash
npm install
npm start
```

Puis ouvrir `http://localhost:4173`.

## Structure des mots

Le fichier source est `backend/data/words.json` avec les champs :
- `id`
- `word`
- `translation`
- `deutch`
- `category`
- `dialect`
- `hint`
- `length`

Le code frontend/backend supporte cette structure et affiche aussi les métadonnées utiles (`hint`, `length`).

## Déploiement LXC

Deux scripts sont fournis dans `scripts/` :
- `install.sh` : installe le jeu et crée le service systemd,
- `update.sh` : met à jour depuis GitHub puis redémarre le service.

Ils ajoutent automatiquement le dépôt à la liste `safe.directory` de Git pour éviter l'erreur "dubious ownership" sous root.

Le service écoute sur le port `4173`.

## Matomo

Configurer les variables d’environnement suivantes sur le service systemd si besoin :
- `MATOMO_URL`
- `MATOMO_SITE_ID`

