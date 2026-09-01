import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}
let securityReady: Promise<unknown> | null = null;
export function ensureSecuritySchema() {
  if (!env.DB) throw new Error("Cloudflare D1 binding DB is unavailable.");
  securityReady ??= env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_security (
    user_id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL,
    encrypted_secret TEXT,
    enabled INTEGER DEFAULT 0 NOT NULL,
    recovery_hashes TEXT,
    updated_at INTEGER NOT NULL
  )`).run();
  return securityReady;
}
let studioReady: Promise<unknown> | null = null;
export function ensureStudioSchema(){
 if(!env.DB)throw new Error("Cloudflare D1 binding DB is unavailable.");
 studioReady??=env.DB.batch([
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS presentations (id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL,title TEXT NOT NULL,slides_json TEXT NOT NULL,updated_at INTEGER NOT NULL)`),
  env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_presentations_user_updated ON presentations(user_id,updated_at DESC)`),
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS presentation_assignments (presentation_id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL,enabled INTEGER DEFAULT 0 NOT NULL,updated_at INTEGER NOT NULL)`),
  env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_presentation_assignments_enabled ON presentation_assignments(enabled,updated_at DESC)`),
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS presentation_images (id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL,content_type TEXT NOT NULL,data BLOB NOT NULL,created_at INTEGER NOT NULL)`),
  env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_presentation_images_user ON presentation_images(user_id)`)
 ]);
 return studioReady;
}
