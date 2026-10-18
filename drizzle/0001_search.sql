-- Full-text search over items (title, line, manufacturer, source, storage location).
-- A standalone FTS5 table keyed by item_id (not external content: items has a text
-- primary key, so its implicit rowid can change on VACUUM). Triggers keep it in sync.
CREATE VIRTUAL TABLE `items_fts` USING fts5(
	item_id UNINDEXED, title, line, manufacturer, acquisition_source, storage_location,
	tokenize='unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER `items_fts_ai` AFTER INSERT ON `items` BEGIN
	INSERT INTO items_fts(item_id, title, line, manufacturer, acquisition_source, storage_location)
	VALUES (new.id, new.title, new.line, new.manufacturer, new.acquisition_source, new.storage_location);
END;
--> statement-breakpoint
CREATE TRIGGER `items_fts_ad` AFTER DELETE ON `items` BEGIN
	DELETE FROM items_fts WHERE item_id = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER `items_fts_au` AFTER UPDATE ON `items` BEGIN
	DELETE FROM items_fts WHERE item_id = old.id;
	INSERT INTO items_fts(item_id, title, line, manufacturer, acquisition_source, storage_location)
	VALUES (new.id, new.title, new.line, new.manufacturer, new.acquisition_source, new.storage_location);
END;
