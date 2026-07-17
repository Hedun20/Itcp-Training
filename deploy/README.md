# ITCP Training production deployment

This directory contains a self-hosted production stack:

- `web`: the compiled React application and internal Nginx reverse proxy;
- `api`: the compiled Express/TypeScript API;
- `mongo`: a private MongoDB instance on the same server;
- persistent Docker volumes for MongoDB data and uploaded course media.

MongoDB and the API do not publish host ports. Only the web service binds to `127.0.0.1:8088` by default, so the hosting panel or host Nginx must expose the public HTTPS domain.

## 1. Confirm the domain

The prepared target is `icp-europe.nl`, exactly as requested. The company name is ITCP Europe, so confirm that the registered DNS name does not include the missing `t` before requesting the TLS certificate.

Create DNS records for the confirmed domain and optional `www` name pointing to the production server.

## 2. Server requirements

The server or its web control-panel terminal must provide:

- Git;
- Docker Engine;
- Docker Compose v2 (`docker compose version`);
- enough storage for MongoDB, uploads, images, and backups.

A file manager alone is not sufficient. SSH is not required when the hosting panel provides a terminal with permission to run Git and Docker commands.

## 3. Check out the repository

For a first installation:

```bash
git clone https://github.com/Hedun20/Itcp-Training.git
cd Itcp-Training
```

For an existing checkout:

```bash
cd Itcp-Training
git checkout main
git pull --ff-only origin main
```

## 4. Create production environment files

```bash
cp deploy/env.stack.example deploy/.env.stack
cp deploy/env.mongo.example deploy/.env.mongo
cp deploy/env.api.example deploy/.env.api
cp deploy/env.seed.example deploy/.env.seed
chmod 600 deploy/.env.stack deploy/.env.mongo deploy/.env.api deploy/.env.seed
```

Generate URL-safe secrets:

```bash
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 24
openssl rand -hex 24
```

Use different values for:

- MongoDB root password;
- MongoDB application password;
- JWT access secret;
- JWT refresh secret;
- administrator password.

The `MONGO_APP_PASSWORD` in `.env.mongo` must exactly match the password embedded in `MONGODB_URI` inside `.env.api`. Hexadecimal secrets are URL-safe and can be placed in the MongoDB URI without additional encoding.

Set the real administrator name and email only in `.env.seed`. The API does not receive seed-only administrator credentials during normal operation.

Keep instructor self-registration disabled until a private six-digit instructor code has been agreed. When enabled, place the code only in `.env.api`.

## 5. Validate and start

```bash
chmod +x deploy/scripts/deploy.sh deploy/scripts/backup.sh
./deploy/scripts/deploy.sh --seed
```

`--seed` creates or refreshes the configured administrator and inserts missing canonical training courses. Do not use `--seed` during normal updates unless an intentional administrator password rotation or content seed is required.

The deployment script:

1. validates the Compose configuration;
2. builds the production images;
3. starts MongoDB, API, and web services;
4. optionally runs the one-time seed;
5. checks the API health endpoint.

Manual status and logs:

```bash
docker compose --env-file deploy/.env.stack -f deploy/docker-compose.production.yml ps
docker compose --env-file deploy/.env.stack -f deploy/docker-compose.production.yml logs --tail=200 api
docker compose --env-file deploy/.env.stack -f deploy/docker-compose.production.yml logs --tail=200 mongo
```

Local health checks:

```bash
curl -fsS http://127.0.0.1:8088/healthz
curl -fsS http://127.0.0.1:8088/api/v1/health
```

## 6. Connect the public domain

In the hosting panel, create a reverse proxy from the confirmed HTTPS domain to:

```text
http://127.0.0.1:8088
```

Preserve these headers:

- `Host`;
- `X-Real-IP`;
- `X-Forwarded-For`;
- `X-Forwarded-Proto`.

A generic host-Nginx example is provided in `deploy/host-nginx.conf.example`. Let the hosting panel or host Nginx manage the public TLS certificate. Do not expose MongoDB port `27017` or API port `4000` publicly.

The default `TRUST_PROXY=2` assumes two proxy hops:

```text
hosting-panel proxy -> application Nginx -> Express API
```

Use `TRUST_PROXY=1` only when port `8088` is directly public and no external proxy is in front of the application Nginx.

## 7. Normal updates

```bash
cd Itcp-Training
git checkout main
git pull --ff-only origin main
./deploy/scripts/deploy.sh
```

The persistent `mongo_data` and `uploads_data` volumes are not replaced by image rebuilds.

## 8. Backups

Create a coordinated MongoDB and uploads backup:

```bash
./deploy/scripts/backup.sh
```

Backups are written under `deploy/backups/<UTC timestamp>/` and contain:

- `mongo.archive.gz`;
- `uploads.tar.gz`;
- `SHA256SUMS`.

Copy backups to storage outside the application server. A backup stored only on the same disk does not protect against disk or server loss.

## Important MongoDB note

The application database user is created by MongoDB's initialization script only when the `mongo_data` volume is empty. Changing `.env.mongo` passwords after initialization does not automatically rotate existing MongoDB users. Password rotation must be performed deliberately inside MongoDB, followed by updating `.env.api`.
