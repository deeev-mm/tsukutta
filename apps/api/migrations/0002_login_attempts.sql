-- ブルートフォース対策: ログイン試行のロックアウト管理
CREATE TABLE `login_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`identifier` text NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`updated_at` text NOT NULL
);
CREATE UNIQUE INDEX `login_attempts_scope_identifier_uq` ON `login_attempts` (`scope`,`identifier`);
