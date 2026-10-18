CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`categories` text DEFAULT '[]' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `item_embeddings` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`photo_uri` text NOT NULL,
	`vector` blob,
	`created_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `item_embeddings_item_idx` ON `item_embeddings` (`item_id`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`title` text NOT NULL,
	`line` text,
	`line_url` text,
	`category` text,
	`status` text NOT NULL,
	`origin` text DEFAULT 'OFFICIAL' NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`variant_tags` text DEFAULT '[]' NOT NULL,
	`priority` text,
	`estimated_price` integer,
	`purchase_price` integer,
	`currency` text NOT NULL,
	`acquisition_date` text,
	`acquisition_source` text,
	`condition` text,
	`storage_location` text,
	`release_year` integer,
	`manufacturer` text,
	`size` text,
	`barcode` text,
	`photos` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `items_collection_status_idx` ON `items` (`collection_id`,`status`);--> statement-breakpoint
CREATE INDEX `items_barcode_idx` ON `items` (`barcode`);--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`date` text NOT NULL,
	`title` text NOT NULL,
	`notes` text,
	`entry_type` text NOT NULL,
	`is_grail` integer DEFAULT false NOT NULL,
	`item_ids` text DEFAULT '[]' NOT NULL,
	`photos` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `journal_collection_date_idx` ON `journal_entries` (`collection_id`,"date" DESC);