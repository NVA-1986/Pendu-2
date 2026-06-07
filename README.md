# Pendu Schwiiz

PWA simplifiée du jeu du pendu en suisse-allemand.

## Lancer le projet

```bash
npm install
npm start
```

Puis ouvrir `http://localhost:3000`.

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
