CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`roomKey` varchar(32) NOT NULL DEFAULT 'silelo',
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`provider` varchar(64),
	`model` varchar(128),
	`status` enum('complete','error') NOT NULL DEFAULT 'complete',
	`traceId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`clientCreatedAt` bigint,
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
