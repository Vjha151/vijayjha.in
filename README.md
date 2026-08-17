# VijayJha.in

Immersive React/Three.js portfolio with a protected SQLite-backed admin CMS.

## Local development

Requires Node.js 22.13 or newer.

```bash
cp .env.example .env
npm ci
npm run dev
```

The Node server reads `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optionally `PORT`
from the process environment. Do not commit `.env`.

## Ubuntu VPS deployment

Production runs as Nginx → Node.js on `127.0.0.1:3000`. Node serves the Vite
build, SPA route fallbacks, admin API, uploads, and SQLite data.

```bash
sudo mkdir -p /var/www/vijayjha
sudo chown -R "$USER":www-data /var/www/vijayjha
cd /var/www/vijayjha
git clone YOUR_GITHUB_REPOSITORY_URL .
npm ci
npm run build
sudo mkdir -p data/uploads
sudo chown -R www-data:www-data data
sudo chmod 750 data
```

Create the untracked server secret file:

```bash
sudo install -m 600 -o root -g root /dev/null /etc/vijayjha.env
sudo nano /etc/vijayjha.env
```

Add `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least 12 characters.

```bash
sudo cp deploy/vijayjha.service /etc/systemd/system/vijayjha.service
sudo systemctl daemon-reload
sudo systemctl enable --now vijayjha
sudo cp deploy/nginx.conf /etc/nginx/sites-available/vijayjha.in
sudo ln -s /etc/nginx/sites-available/vijayjha.in /etc/nginx/sites-enabled/vijayjha.in
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d vijayjha.in -d www.vijayjha.in
```

HTTPS is required because production admin cookies are Secure. Direct refresh
works for `/`, `/about`, `/blog`, `/contact`, and `/admin` through the server's
SPA fallback.

## Production updates

```bash
cd /var/www/vijayjha
git pull --ff-only
npm ci
npm run build
sudo systemctl restart vijayjha
```

Back up `/var/www/vijayjha/data` regularly. It contains SQLite data and uploads.
