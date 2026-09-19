# GariFile domain rollout on the existing VPS

GariFile has its own HTML entry and React bundle (`garifile.html`). The server
selects it for `garifile.com`; `garifile.in` and both `www` aliases redirect to
`https://garifile.com`, preserving paths and query strings. VijayJha.in retains
its portfolio. The legacy `/cars` entry continues to work.

This first rollout intentionally retains the existing Node application and
persistent `/app/data` volume. Vehicle records, files, accounts, permissions and
passwords remain in place. Users sign in again on the new domain because cookies
are host-only. This is separate website branding, not a database migration or an
independently isolated backend. Do not create an empty replacement volume or run
two reminder schedulers against it.

## Before publishing

1. Confirm the current production app and VPS IP in Coolify/Hostinger. DNS observed
   during preparation: VijayJha.in A `200.141.13.9`; both GariFile domains A
   `2.57.91.91`. Confirm the actual VPS IP rather than assuming DNS is authoritative
   about the origin server.
2. In the existing production container, run `npm run backup:vehicles`. Preserve
   its consistent SQLite snapshot and documents, plus the current deployed commit
   and Coolify domain configuration for rollback.
3. Build and test this release (`npm run build`, `npm test`). Deploy the code to the
   **existing** Coolify application without changing its `/app/data` storage.
4. In Hostinger DNS for each GariFile domain, set the root `@` A record to the
   confirmed VPS IPv4. Keep `www` as a CNAME to its corresponding root. Review
   existing AAAA records: they must point to a working IPv6 address of this same
   VPS, or be removed if IPv6 is not configured. Preserve all MX/TXT email records.
5. Add `https://garifile.com`, `https://www.garifile.com`, `https://garifile.in` and
   `https://www.garifile.in` to the same Coolify application's existing domains.
   Retain VijayJha.in and its current settings. Use Coolify's HTTPS certificate
   management and ensure it forwards the original Host header. Do not put a
   domain-wide redirect to VijayJha.in in front of these domains.
6. Verify valid HTTPS on all four names; `.in`/`www` must redirect to `.com`.
   Verify the portfolio still loads on VijayJha.in, GariFile loads at `/`, old
   `/cars` deep links work, sign-in shows the existing vehicle count, authorized
   document viewing works and another user's documents are inaccessible.

Email provider, sender address and SMTP credentials are deferred by request.
Existing email behavior is unchanged; its links continue using APP_BASE_URL
until that configuration is addressed separately. No challan/VAHAN API or app
store submission is included in this domain rollout.

## Local standalone preview

Set `SITE_MODE=garifile` only for a local preview or a future dedicated deployment:

```powershell
$env:SITE_MODE='garifile'
$env:PORT='3100'
npm run dev
```

Leave SITE_MODE **unset** in the shared production container; otherwise the
portfolio hostname will also receive GariFile. The preview uses local data only.

## Rollback

Restore the previous deployed commit and the saved Coolify domain configuration.
No database migration is performed by this change. Keep the persistent volume
intact. Restore data from backup only if data restoration is actually necessary;
a website rollback by itself does not justify overwriting newer records.
