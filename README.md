<div align="center">

# ServerHub

**Inventaire multi-providers, collecte SSH automatique, terminal web intégré et vue datacenter — le tout dans une interface console élégante.**

Next.js 15 · FastAPI · Kubernetes / Helm

</div>

---

## Aperçu

ServerHub centralise la gestion de votre parc de serveurs :

- **Liste console** de tous les serveurs (statut live, IP, provider, OS, dernière synchro) avec recherche instantanée.
- **Terminal SSH dans le navigateur** (xterm.js) attaché en bas de l'écran, redimensionnable, persistant pendant la navigation.
- **Barre de commande** type shell (`serverhub ❯`) pour naviguer et lancer des outils de debug : `ssh`, `sync`, `whois`, `dig`, `ping`, `find`…
- **Coffre d'identifiants** : clés SSH et couples user/mot de passe réutilisables, avec profil par défaut appliqué automatiquement aux nouveaux serveurs (secrets chiffrés au repos via Fernet).
- **Vue Datacenter** : baies visualisées en U, **glisser-déposer** des serveurs, **redimensionnement** multi-U par les bords, taille des U réglable.
- **Synchronisation Cloud** : import automatique des serveurs/VM depuis les API **OVH**, **Hetzner** et **Scaleway**.

## Stack

| Couche | Technologies |
|--------|--------------|
| Frontend | Next.js 15 (App Router), Tailwind CSS, Framer Motion, xterm.js, JetBrains Mono |
| Backend | FastAPI, SQLAlchemy, asyncssh, httpx |
| Auth | JWT (python-jose) + bcrypt |
| Chiffrement | Fernet (cryptography) pour les secrets SSH |
| Base de données | SQLite (défaut) / compatible PostgreSQL |
| Déploiement | Docker, Kubernetes (k3s), chart Helm |

## Structure du dépôt

```
serverhub/
├── apps/
│   ├── api/            # Backend FastAPI (auth, serveurs, datacenters, credentials, tools, terminal WS)
│   └── web/            # Frontend Next.js (console, datacenter, identifiants, terminal)
├── deploy/
│   ├── helm/serverhub/ # Chart Helm (recommandé)
│   ├── k8s/            # Manifestes bruts + kustomize
│   └── k8s-deploy.ps1  # Script build+import+deploy pour k3s local/OVH
└── docker-compose.yml  # Stack complète en local
```

## Démarrage rapide (développement)

**Prérequis :** Node.js 20+, Python 3.11+.

### Backend (API)

```bash
cd apps/api
python -m venv .venv
# Windows : .venv\Scripts\activate   |   Linux/macOS : source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Docs API : http://localhost:8000/api/docs

### Frontend (Web)

```bash
cd apps/web
npm install
cp .env.local.example .env.local
npm run dev
```

Interface : http://localhost:3000

### Docker Compose (tout-en-un)

```bash
cp .env.production.example .env   # renseigner SECRET_KEY, FERNET_KEY, URLs
docker compose up --build
```

## Déploiement Kubernetes avec Helm (recommandé)

Le chart se trouve dans [`deploy/helm/serverhub`](deploy/helm/serverhub). Les images
publiques sont disponibles sur Docker Hub (aucune configuration figée dans l'image) :

- `georgeopus/serverhub:api`
- `georgeopus/serverhub:web`

> Le frontend appelle l'API en **relatif** (via l'ingress `/api`) : l'image web
> fonctionne derrière n'importe quel hôte, sans rebuild. Il n'est donc pas
> nécessaire de figer `NEXT_PUBLIC_API_URL` au build.

```bash
# Installation clé en main (images tirées de Docker Hub)
helm upgrade --install serverhub deploy/helm/serverhub \
  --namespace serverhub --create-namespace \
  --set config.corsOrigins=http://mon-hote
```

Aperçu des manifestes générés sans rien appliquer :

```bash
helm template serverhub deploy/helm/serverhub | less
```

### Points clés du chart

- `SECRET_KEY` et `FERNET_KEY` sont **générés automatiquement** au premier déploiement et **préservés** lors des `helm upgrade` (surchargeables via `secrets.secretKey` / `secrets.fernetKey`).
- Ingress Traefik activé par défaut (`/` → web, `/api` → API). Personnalisable via `ingress.*`.
- Persistance de la base SQLite via PVC (`persistence.*`).

### Principales valeurs

| Clé | Défaut | Description |
|-----|--------|-------------|
| `api.image.repository` / `api.image.tag` | `serverhub-api` / `local` | Image API |
| `web.image.repository` / `web.image.tag` | `serverhub-web` / `local` | Image Web |
| `config.corsOrigins` | `http://localhost` | Origines CORS autorisées |
| `config.databaseUrl` | `sqlite:///./data/serverhub.db` | Chaîne de connexion BDD |
| `secrets.secretKey` / `secrets.fernetKey` | *(généré)* | Secrets JWT & chiffrement |
| `ingress.enabled` | `true` | Active l'Ingress |
| `ingress.className` | `""` | Classe d'Ingress (ex. `traefik`, `nginx`) |
| `ingress.host` | `""` | Hôte (vide = catch-all) |
| `persistence.enabled` / `persistence.size` | `true` / `1Gi` | Volume de données API |

Un exemple prêt à l'emploi : [`values-ovh.example.yaml`](deploy/helm/serverhub/values-ovh.example.yaml).

### Déploiement k3s « clé en main » (Windows / OVH)

Le script PowerShell construit les images, les importe dans le nœud k3s et applique le déploiement :

```powershell
.\deploy\k8s-deploy.ps1 -KubeConfigPath "C:\chemin\vers\kubeconfig"
```

## Variables d'environnement

### API

| Variable | Défaut | Description |
|----------|--------|-------------|
| `SECRET_KEY` | `dev-secret-change-in-production` | Clé de signature JWT |
| `FERNET_KEY` | *(vide)* | Clé de chiffrement des secrets SSH (obligatoire en prod) |
| `DATABASE_URL` | `sqlite:///./data/serverhub.db` | Connexion BDD |
| `CORS_ORIGINS` | `http://localhost:3000` | Origines autorisées (séparées par des virgules) |
| `ALLOW_REGISTRATION` | `false` | Autorise l'inscription publique |

### Web

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Vide par défaut → appels API en **relatif** (même origine, via l'ingress `/api`). À définir uniquement quand l'API est sur une autre origine (ex. dev : `http://localhost:8000`). |

Générer une clé Fernet valide :

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## Sécurité

- Utilisez **HTTPS** en production et changez `SECRET_KEY`.
- Les clés SSH et mots de passe sont **chiffrés au repos** (Fernet) ; conservez `FERNET_KEY` en lieu sûr (sa perte rend les secrets illisibles).
- Les outils réseau (`whois`/`dig`/`ping`) valident strictement la cible et s'exécutent sans shell (aucune injection possible).
- N'exposez jamais l'API sans authentification.

## Licence

Projet privé — tous droits réservés.
