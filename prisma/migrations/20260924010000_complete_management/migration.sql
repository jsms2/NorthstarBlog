-- DropIndex
DROP INDEX `AnalyticsAggregate_date_path_key` ON `AnalyticsAggregate`;

-- AlterTable
ALTER TABLE `Admin` ADD COLUMN `pendingTotpSecret` TEXT NULL;

-- AlterTable
ALTER TABLE `AnalyticsAggregate` ADD COLUMN `dimension` VARCHAR(40) NOT NULL DEFAULT 'path',
    ADD COLUMN `value` VARCHAR(500) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `AnalyticsEvent` ADD COLUMN `utmCampaign` VARCHAR(191) NULL,
    ADD COLUMN `utmMedium` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Category` ADD COLUMN `position` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `seoDescription` VARCHAR(500) NULL,
    ADD COLUMN `seoTitle` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `Page` ADD COLUMN `canonicalUrl` VARCHAR(1000) NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `excerpt` TEXT NULL,
    ADD COLUMN `nofollow` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `noindex` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Redirect` ADD COLUMN `enabled` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `Series` ADD COLUMN `seoDescription` VARCHAR(500) NULL,
    ADD COLUMN `seoTitle` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `Tag` ADD COLUMN `seoDescription` VARCHAR(500) NULL,
    ADD COLUMN `seoTitle` VARCHAR(255) NULL;

-- CreateTable
CREATE TABLE `AuthChallenge` (
    `id` VARCHAR(191) NOT NULL,
    `adminId` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AuthChallenge_tokenHash_key`(`tokenHash`),
    INDEX `AuthChallenge_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `AnalyticsAggregate_date_dimension_value_key` ON `AnalyticsAggregate`(`date`, `dimension`, `value`);

-- AddForeignKey
ALTER TABLE `AuthChallenge` ADD CONSTRAINT `AuthChallenge_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `Admin`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
