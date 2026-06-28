# Iagona Dash Temp — Backend + Frontend

Ce dépôt contient un dashboard frontend (`index.html`) et un backend Node.js minimal (`server.js`) pour stocker les profils et logs de températures.

## Déploiement sur Render (recommandé)

1. Crée un service Web Node sur Render et connecte ton repo.
2. Dans les settings du service, configure :
   - Build Command: `npm install`
   - Start Command: `npm start`
3. Variables d'environnement (dans Render dashboard) :
   - `API_TOKEN` : (recommandé) token pour protéger les endpoints POST/DELETE
   - `DATABASE_URL` : (optionnel) URL Postgres si tu utilises Render Postgres. Si absent, le backend utilise SQLite local.
   - `NODE_ENV` : `production`
4. Définis `API_BASE_URL` côté frontend pour pointer vers ton service Render (par ex. `https://iagona-dash-temp.onrender.com`).

## Local

Installer et démarrer :

```bash
npm install
npm start
```

Le serveur écoute sur le port `process.env.PORT` ou `3000`.

## Sécurité

- Ne stocke jamais de secrets dans le repo. Utilise les variables d'environnement Render.
- Le frontend ne doit pas contenir de token en clair.

## Notes

- Le backend supporte Postgres (si `DATABASE_URL` fourni) et SQLite (fallback dans `data/app.db`).
- Les endpoints protégés par token sont : `POST /api/profiles`, `DELETE /api/profiles/:name`, `POST /api/logs`.
