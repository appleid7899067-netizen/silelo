CREATE TABLE `chat_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`roomKey` varchar(32) NOT NULL DEFAULT 'silelo',
	`eventType` varchar(64) NOT NULL,
	`label` varchar(255) NOT NULL,
	`detail` text,
	`status` enum('running','success','error','waiting_confirmation','cancelled') NOT NULL DEFAULT 'success',
	`createdAtUtc` bigint NOT NULL DEFAULT 0,
	CONSTRAINT `chat_events_id` PRIMARY KEY(`id`)
);
