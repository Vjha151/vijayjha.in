# Coolify production configuration

This application is deployed by Coolify as a single Node container with the
repository mounted/built at `/app`. It does not depend on host systemd units or
`/etc/vijayjha.env`.

## Build and start

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Persistent storage destination: `/app/data`

The persistent `/app/data` mount is required for `site.db`, the email delivery
ledger, public CMS uploads and private vehicle document versions.

## Gmail environment variables

Configure these in the Coolify application's Environment Variables page:

```dotenv
APP_BASE_URL=https://vijayjha.in
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=gaadifile@gmail.com
SMTP_PASSWORD=YOUR_GOOGLE_APP_PASSWORD
MAIL_FROM=gaadifile@gmail.com
MAIL_FROM_NAME=GaadiFile
VEHICLE_REMINDERS_ENABLED=true
```

Redeploy after changing environment variables. Do not store the App Password
in Git, a Dockerfile or a Compose file.

## Reminder schedule

`server.mjs` starts `vehicle-reminder-scheduler.mjs` whenever the production
container starts. The scheduler evaluates time explicitly in `Asia/Kolkata`,
so it does not depend on the Docker host or Coolify server timezone.

- Schedule: daily at 08:00 Asia/Kolkata
- Command executed: `node /app/vehicle-reminders.mjs`
- Failure retry: every 15 minutes during the same day
- Restart behavior: starts again with the container; a restart after 08:00
  triggers a catch-up execution
- Duplicate protection: `email_reminder_deliveries` in `/app/data/site.db`

Do not also configure a Coolify Scheduled Task while the container scheduler
is enabled. If a platform-managed task is preferred later, first set
`VEHICLE_REMINDERS_ENABLED=false`, then create one Coolify Scheduled Task for
`npm run reminders` and confirm the Coolify server timezone before choosing
its cron expression.

Use the Coolify terminal to verify SMTP without sending mail:

```bash
npm run smtp:verify
```

Set `SMTP_TEST_TO` temporarily and use `npm run smtp:test-reminder` to send one
clearly labelled test email.
