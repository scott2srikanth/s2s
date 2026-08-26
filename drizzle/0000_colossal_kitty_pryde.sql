CREATE TABLE `user_security` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`encrypted_secret` text,
	`enabled` integer DEFAULT false NOT NULL,
	`recovery_hashes` text,
	`updated_at` integer NOT NULL
);
