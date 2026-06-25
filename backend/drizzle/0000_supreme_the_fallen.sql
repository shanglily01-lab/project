CREATE TABLE `ops_activity_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`person_id` int NOT NULL,
	`task_id` int,
	`journal_id` int NOT NULL,
	`activity_at` timestamp NOT NULL,
	`day` date NOT NULL,
	`kind` varchar(32) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ops_activity_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_activity_events_journal` UNIQUE(`journal_id`)
);
--> statement-breakpoint
CREATE TABLE `ops_change_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`task_id` int,
	`change_type` varchar(32) NOT NULL,
	`detail` text NOT NULL,
	`subject` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ops_change_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ops_code_daily` (
	`id` int AUTO_INCREMENT NOT NULL,
	`person_id` int NOT NULL,
	`date` date NOT NULL,
	`commits` int NOT NULL,
	`substantive_commits` int NOT NULL,
	`raw_loc` int NOT NULL,
	`effective_loc` int NOT NULL,
	`task_linked_commits` int NOT NULL,
	`confidence` varchar(8) NOT NULL,
	`flags` json NOT NULL,
	`sample_messages` json NOT NULL,
	`repos` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ops_code_daily_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_code_daily_person_date` UNIQUE(`person_id`,`date`)
);
--> statement-breakpoint
CREATE TABLE `ops_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`target_type` varchar(16) NOT NULL,
	`target_id` varchar(255) NOT NULL,
	`date` date NOT NULL,
	`author` varchar(128),
	`body` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ops_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ops_commit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`person_id` int NOT NULL,
	`repo` varchar(128) NOT NULL,
	`sha` varchar(64) NOT NULL,
	`committed_at` timestamp NOT NULL,
	`day` date NOT NULL,
	`task_linked` boolean NOT NULL DEFAULT false,
	`message_subject` varchar(200),
	`linked_task_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ops_commit_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_commit_events_sha` UNIQUE(`sha`)
);
--> statement-breakpoint
CREATE TABLE `ops_person_daily` (
	`id` int AUTO_INCREMENT NOT NULL,
	`person_id` int NOT NULL,
	`date` date NOT NULL,
	`op_name` varchar(255) NOT NULL,
	`total_tasks` int NOT NULL,
	`in_progress` int NOT NULL,
	`blocked` int NOT NULL,
	`closed_count` int NOT NULL,
	`pct_sum` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ops_person_daily_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_person_daily_person_date` UNIQUE(`person_id`,`date`)
);
--> statement-breakpoint
CREATE TABLE `ops_person_identity` (
	`person_id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`op_name` varchar(255) NOT NULL,
	`git_emails` json NOT NULL,
	`iam_arn` varchar(512),
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ops_person_identity_person_id` PRIMARY KEY(`person_id`)
);
--> statement-breakpoint
CREATE TABLE `ops_project_daily` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_name` varchar(255) NOT NULL,
	`date` date NOT NULL,
	`total_tasks` int NOT NULL,
	`in_progress` int NOT NULL,
	`blocked` int NOT NULL,
	`closed` int NOT NULL,
	`new_tasks` int NOT NULL,
	`avg_pct` int NOT NULL,
	`pct_delta` int,
	`health` varchar(16) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ops_project_daily_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_project_daily_name_date` UNIQUE(`project_name`,`date`)
);
--> statement-breakpoint
CREATE TABLE `ops_task_relations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`from_id` int NOT NULL,
	`to_id` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`description` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ops_task_relations_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_relation` UNIQUE(`from_id`,`to_id`,`type`)
);
--> statement-breakpoint
CREATE TABLE `ops_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`external_id` int,
	`subject` text NOT NULL,
	`status_name` varchar(128) NOT NULL,
	`priority_name` varchar(64) NOT NULL,
	`assignee` varchar(255),
	`author` varchar(255),
	`project_name` varchar(255),
	`type_name` varchar(64),
	`pct` int,
	`due_date` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ops_tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `ops_tasks_external_id_unique` UNIQUE(`external_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_activity_events_person_day` ON `ops_activity_events` (`person_id`,`day`);--> statement-breakpoint
CREATE INDEX `idx_changelog_task` ON `ops_change_log` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_changelog_type` ON `ops_change_log` (`change_type`);--> statement-breakpoint
CREATE INDEX `idx_code_daily_person` ON `ops_code_daily` (`person_id`);--> statement-breakpoint
CREATE INDEX `idx_comments_target` ON `ops_comments` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `idx_commit_events_person_day` ON `ops_commit_events` (`person_id`,`day`);--> statement-breakpoint
CREATE INDEX `idx_person_daily_person` ON `ops_person_daily` (`person_id`);--> statement-breakpoint
CREATE INDEX `idx_identity_op_name` ON `ops_person_identity` (`op_name`);--> statement-breakpoint
CREATE INDEX `idx_project_daily_name` ON `ops_project_daily` (`project_name`);--> statement-breakpoint
CREATE INDEX `idx_project_daily_date` ON `ops_project_daily` (`date`);--> statement-breakpoint
CREATE INDEX `idx_tasks_assignee` ON `ops_tasks` (`assignee`);--> statement-breakpoint
CREATE INDEX `idx_tasks_project` ON `ops_tasks` (`project_name`);--> statement-breakpoint
CREATE INDEX `idx_tasks_status` ON `ops_tasks` (`status_name`);