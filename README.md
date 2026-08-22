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

The authenticated private vehicle workspace is available at
`/vehicles`. Legacy `/private/vehicles` page URLs redirect to the new route. Vehicle and dashboard APIs use
`/api/private/vehicles/*`. Vehicle search and type filters are paginated on
the server (20 rows per UI page); the database does not impose a maximum
vehicle or per-vehicle document count. Private documents are stored under
`data/private-vehicle-documents/` and are served only after session and
vehicle/document ownership checks.

```bash
sudo mkdir -p /var/www/vijayjha
sudo chown -R "$USER":www-data /var/www/vijayjha
cd /var/www/vijayjha
git clone YOUR_GITHUB_REPOSITORY_URL .
npm ci
npm run build
sudo mkdir -p data/uploads data/private-vehicle-documents
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

Back up `/var/www/vijayjha/data` regularly. It contains SQLite data, public
uploads, and private vehicle documents. Restore the entire directory together
while the service is stopped so document metadata and files stay consistent.

## Multi-user Vehicle Manager

On first startup, the admin account is created from `ADMIN_EMAIL` and
`ADMIN_PASSWORD`; legacy vehicle records are assigned to that owner. Configure
`APP_BASE_URL` and the `SMTP_*` variables in `.env.example` for password-reset
and reminder delivery.

### GaadiFile Gmail reminders

Create a Google App Password for `gaadifile@gmail.com` (2-Step Verification
must be enabled), then add the following as Coolify application environment
variables. Never commit the App Password.

```dotenv
APP_BASE_URL=https://vijayjha.in
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=gaadifile@gmail.com
SMTP_PASSWORD=YOUR_16_CHARACTER_GOOGLE_APP_PASSWORD
MAIL_FROM=gaadifile@gmail.com
MAIL_FROM_NAME=GaadiFile
VEHICLE_REMINDERS_ENABLED=true
```

Verify the credentials without sending an email with `npm run smtp:verify`.
Set `SMTP_TEST_TO` and run `npm run smtp:test-reminder` to send one clearly
labelled test reminder; it does not read or alter production reminder rows.
The production Node process starts a container-native scheduler. It runs daily
at 08:00 Asia/Kolkata and sends idempotent email reminders 10, 5 and 1 day
before expiry and on the expiry date. It covers the current uploaded document
plus First Party, Third Party, PUC and temporary registration expiry metadata.
Delivery status, attempts, Gmail message ID and a sanitized failure reason are
stored in SQLite. The scheduler restarts with the application container and
performs a same-day catch-up when a restart occurs after 08:00. The SQLite
delivery ledger remains the authority that prevents duplicate messages.

```bash
npm run backup:vehicles
```

Coolify must mount persistent storage at `/app/data`; this preserves SQLite,
the reminder ledger and private vehicle documents across deployments. The old
`deploy/vijayjha-reminders.service` and `.timer` files are legacy VPS examples
only and are not used by the Coolify deployment. See `deploy/COOLIFY.md`.

Backups contain a consistent SQLite snapshot, private documents, and a
manifest. For Coolify restore, stop the application and restore `site.db` plus
`private-vehicle-documents/` together into the persistent volume mounted at
`/app/data`, then start the application. Keep a second backup outside the
application volume.
