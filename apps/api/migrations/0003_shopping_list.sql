-- 買い物リスト: 家族共有の1本のチェックリスト
CREATE TABLE `shopping_list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`name` text NOT NULL,
	`source_recipe_id` text,
	`is_checked` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX `idx_shopping_list_family_id` ON `shopping_list_items` (`family_id`,`is_checked`);
