CREATE TABLE `epi_technical_sheets` (
	`code` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`author` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`code`) REFERENCES `epi_products`(`code`) ON UPDATE no action ON DELETE no action
);
