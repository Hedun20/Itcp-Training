# PM2 deployment on s636490

This is the preferred deployment for the existing ITCP server discovered on 17 July 2026.

## Existing server layout

- Ubuntu 24.04
- system Nginx on ports 80/443
- PM2 already manages the CRM and ITCP Services API
- MongoDB 8 listens only on `127.0.0.1:27017`
- ports 4000, 4100, and 4200 are already allocated
- ITCP Training uses port 4300

## Paths

- repository: `/opt/itcp-training`
- frontend web root: `/var/www/itcp-training`
- runtime uploads: `/opt/itcp-training/server/uploads`
- logs: `/var/log/itcp-training`
- Nginx site: `/etc/nginx/sites-available/itcp-training`

## First installation

```bash
cd /opt
git clone https://github.com/Hedun20/Itcp-Training.git itcp-training
cd /opt/itcp-training
cp deploy/env.pm2.example .env
chmod 600 .env
```

Generate two different JWT secrets:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Place them in `.env`. Do not change the existing CRM MongoDB configuration. Training uses the separate local database `itcp_training`.

Build and start:

```bash
chmod +x deploy/scripts/deploy-pm2.sh
./deploy/scripts/deploy-pm2.sh
```

Create the first administrator and canonical courses without placing the password in shell history:

```bash
read -r -p "Admin name: " ADMIN_NAME
read -r -p "Admin email: " ADMIN_EMAIL
read -r -s -p "Admin password: " ADMIN_PASSWORD; echo
export ADMIN_NAME ADMIN_EMAIL ADMIN_PASSWORD
npm run seed
unset ADMIN_NAME ADMIN_EMAIL ADMIN_PASSWORD
```

## HTTPS

After DNS for `itcpeurope.nl` points to `89.149.201.170`, issue or attach the TLS certificate through the server's existing Certbot/Nginx workflow.

## Updates

```bash
cd /opt/itcp-training
git checkout main
git pull --ff-only origin main
./deploy/scripts/deploy-pm2.sh
```

## Verification

```bash
pm2 status
pm2 logs itcp-training-api --lines 100
curl -fsS http://127.0.0.1:4300/api/v1/health
nginx -t
```
