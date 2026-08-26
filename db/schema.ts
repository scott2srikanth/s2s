import {blob,integer,sqliteTable,text} from "drizzle-orm/sqlite-core";
export const userSecurity=sqliteTable("user_security",{
 userId:text("user_id").primaryKey(),email:text("email").notNull(),
 encryptedSecret:text("encrypted_secret"),enabled:integer("enabled",{mode:"boolean"}).notNull().default(false),
 recoveryHashes:text("recovery_hashes"),updatedAt:integer("updated_at",{mode:"timestamp"}).notNull().$defaultFn(()=>new Date())
});
export const presentations=sqliteTable("presentations",{
 id:text("id").primaryKey(),userId:text("user_id").notNull(),title:text("title").notNull(),
 slidesJson:text("slides_json").notNull(),updatedAt:integer("updated_at").notNull()
});
export const presentationImages=sqliteTable("presentation_images",{
 id:text("id").primaryKey(),userId:text("user_id").notNull(),contentType:text("content_type").notNull(),
 data:blob("data",{mode:"buffer"}).notNull(),createdAt:integer("created_at").notNull()
});
