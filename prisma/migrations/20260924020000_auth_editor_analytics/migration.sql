-- CreateTable
CREATE TABLE `AnalyticsVisitorDay` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `visitorHash` CHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AnalyticsVisitorDay_date_idx`(`date`),
    UNIQUE INDEX `AnalyticsVisitorDay_date_visitorHash_key`(`date`, `visitorHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
