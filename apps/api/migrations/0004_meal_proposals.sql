-- 「今日のご飯何がいい?」提案・投票
CREATE TABLE `meal_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`for_date` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`decided_recipe_id` text,
	`decided_at` text,
	`created_by_user_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`decided_recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX `meal_proposals_family_date_uq` ON `meal_proposals` (`family_id`,`for_date`);

CREATE TABLE `meal_proposal_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`recipe_id` text NOT NULL,
	`added_by_user_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`proposal_id`) REFERENCES `meal_proposals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`added_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX `meal_proposal_candidates_uq` ON `meal_proposal_candidates` (`proposal_id`,`recipe_id`);

CREATE TABLE `meal_proposal_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`proposal_id`) REFERENCES `meal_proposals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`candidate_id`) REFERENCES `meal_proposal_candidates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX `meal_proposal_votes_proposal_user_uq` ON `meal_proposal_votes` (`proposal_id`,`user_id`);
