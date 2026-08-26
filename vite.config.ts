import { sites } from "@openai/sites-vite-plugin";
import vinext from "vinext";
import { defineConfig, loadEnv } from "vite";
import hostingConfig from "./.openai/hosting.json";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig(async ({mode}) => {
  const localSecrets = loadEnv(mode, process.cwd(), "");
  const databaseId = localSecrets.D1_DATABASE_ID ||
    (mode === "development" ? SITE_CREATOR_PLACEHOLDER_DATABASE_ID : undefined);
  if (d1 && !databaseId) {
    throw new Error(
      "D1_DATABASE_ID is required for production builds. Create the S2S D1 database and configure its real UUID in the deployment environment."
    );
  }
  const bindingConfig = {
    main: "./worker/index.ts",
    compatibility_flags: ["nodejs_compat"],
    d1_databases: d1
      ? [{binding:d1,database_name:"s2s",database_id:databaseId!}]
      : [],
    r2_buckets: r2
      ? [{binding:r2,bucket_name:"site-creator-r2"}]
      : [],
  };
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      // Listen on the Mac's network interfaces so trusted Tailscale peers can
      // reach the development studio. Authentication and 2FA remain enforced.
      host: "0.0.0.0",
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: {
          ...bindingConfig,
          // Production authentication values are configured as encrypted
          // Cloudflare secrets. Plain vars are only used by the local emulator.
          vars: mode === "development" ? {
            AUTH_USERNAME: localSecrets.AUTH_USERNAME,
            AUTH_PASSWORD: localSecrets.AUTH_PASSWORD,
            AUTH_SESSION_SECRET: localSecrets.AUTH_SESSION_SECRET,
            TOTP_ENCRYPTION_KEY: localSecrets.TOTP_ENCRYPTION_KEY,
          } : {},
        },
      }),
    ],
  };
});
