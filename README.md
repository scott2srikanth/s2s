# S2S Studio

## Cloudflare deployment

The application requires a Cloudflare D1 database bound as `DB`. Create it once in the same Cloudflare account that deploys the Worker:

```bash
npx wrangler login
npx wrangler d1 create s2s
```

Copy the returned `database_id` UUID into the deployment environment as `D1_DATABASE_ID`. Configure `AUTH_USERNAME`, `AUTH_PASSWORD`, `AUTH_SESSION_SECRET`, and `TOTP_ENCRYPTION_KEY` through the Cloudflare dashboard under **Workers & Pages → s2s → Settings → Variables and Secrets**, selecting **Encrypt** for every value. Do not commit their values.

For a CLI deployment, export the database ID before building:

```bash
export D1_DATABASE_ID="the-real-d1-uuid"
npm run build
```

The database tables are created automatically on first authenticated use. Local `npm run dev` continues to use the project-local D1 emulator and does not require a production UUID.
