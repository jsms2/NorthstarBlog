-- CreateTable
CREATE TABLE `Admin` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(64) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `totpSecret` TEXT NULL,
    `recoveryCodes` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Admin_username_key`(`username`),
    UNIQUE INDEX `Admin_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `adminId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `userAgent` VARCHAR(500) NULL,
    `ipHash` CHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Session_tokenHash_key`(`tokenHash`),
    INDEX `Session_adminId_expiresAt_idx`(`adminId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Post` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `excerpt` TEXT NULL,
    `markdown` LONGTEXT NOT NULL,
    `html` LONGTEXT NOT NULL,
    `editorJson` JSON NULL,
    `searchText` LONGTEXT NOT NULL,
    `coverUrl` VARCHAR(1000) NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'PUBLISHED', 'PRIVATE', 'TRASH') NOT NULL DEFAULT 'DRAFT',
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `allowComments` BOOLEAN NOT NULL DEFAULT true,
    `showToc` BOOLEAN NOT NULL DEFAULT true,
    `wordCount` INTEGER NOT NULL DEFAULT 0,
    `readingMinutes` INTEGER NOT NULL DEFAULT 1,
    `views` INTEGER NOT NULL DEFAULT 0,
    `publishedAt` DATETIME(3) NULL,
    `scheduledAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `seoTitle` VARCHAR(255) NULL,
    `seoDescription` VARCHAR(500) NULL,
    `canonicalUrl` VARCHAR(1000) NULL,
    `ogImage` VARCHAR(1000) NULL,
    `noindex` BOOLEAN NOT NULL DEFAULT false,
    `nofollow` BOOLEAN NOT NULL DEFAULT false,
    `cssClass` VARCHAR(191) NULL,
    `headCode` LONGTEXT NULL,
    `footerCode` LONGTEXT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Post_slug_key`(`slug`),
    INDEX `Post_status_publishedAt_idx`(`status`, `publishedAt`),
    INDEX `Post_status_scheduledAt_idx`(`status`, `scheduledAt`),
    INDEX `Post_categoryId_idx`(`categoryId`),
    FULLTEXT INDEX `Post_title_excerpt_searchText_idx`(`title`, `excerpt`, `searchText`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostRevision` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `markdown` LONGTEXT NOT NULL,
    `editorJson` JSON NULL,
    `summary` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PostRevision_postId_createdAt_idx`(`postId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Page` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `markdown` LONGTEXT NOT NULL,
    `html` LONGTEXT NOT NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'PUBLISHED', 'PRIVATE', 'TRASH') NOT NULL DEFAULT 'DRAFT',
    `template` VARCHAR(64) NOT NULL DEFAULT 'default',
    `allowComments` BOOLEAN NOT NULL DEFAULT false,
    `customCss` LONGTEXT NULL,
    `customJs` LONGTEXT NULL,
    `seoTitle` VARCHAR(255) NULL,
    `seoDescription` VARCHAR(500) NULL,
    `publishedAt` DATETIME(3) NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Page_slug_key`(`slug`),
    INDEX `Page_status_publishedAt_idx`(`status`, `publishedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `coverUrl` VARCHAR(1000) NULL,
    `parentId` VARCHAR(191) NULL,

    UNIQUE INDEX `Category_slug_key`(`slug`),
    INDEX `Category_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tag` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(20) NULL,

    UNIQUE INDEX `Tag_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostTag` (
    `postId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,

    INDEX `PostTag_tagId_idx`(`tagId`),
    PRIMARY KEY (`postId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Series` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `coverUrl` VARCHAR(1000) NULL,

    UNIQUE INDEX `Series_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeriesPost` (
    `seriesId` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `SeriesPost_seriesId_position_key`(`seriesId`, `position`),
    PRIMARY KEY (`seriesId`, `postId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Comment` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `authorName` VARCHAR(100) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `website` VARCHAR(500) NULL,
    `content` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'SPAM', 'TRASH') NOT NULL DEFAULT 'PENDING',
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `isAdmin` BOOLEAN NOT NULL DEFAULT false,
    `likes` INTEGER NOT NULL DEFAULT 0,
    `ipHash` CHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Comment_postId_status_createdAt_idx`(`postId`, `status`, `createdAt`),
    INDEX `Comment_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Media` (
    `id` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(500) NOT NULL,
    `url` VARCHAR(1000) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(150) NOT NULL,
    `type` ENUM('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'ARCHIVE', 'OTHER') NOT NULL,
    `size` INTEGER NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `alt` VARCHAR(500) NULL,
    `caption` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Media_storageKey_key`(`storageKey`),
    INDEX `Media_type_createdAt_idx`(`type`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Navigation` (
    `id` VARCHAR(191) NOT NULL,
    `location` VARCHAR(20) NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `url` VARCHAR(1000) NOT NULL,
    `icon` VARCHAR(100) NULL,
    `newWindow` BOOLEAN NOT NULL DEFAULT false,
    `position` INTEGER NOT NULL DEFAULT 0,
    `parentId` VARCHAR(191) NULL,

    INDEX `Navigation_location_position_idx`(`location`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Link` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `url` VARCHAR(1000) NOT NULL,
    `logo` VARCHAR(1000) NULL,
    `description` VARCHAR(500) NULL,
    `group` VARCHAR(100) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `visible` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Redirect` (
    `id` VARCHAR(191) NOT NULL,
    `source` VARCHAR(500) NOT NULL,
    `destination` VARCHAR(1000) NOT NULL,
    `statusCode` INTEGER NOT NULL DEFAULT 301,
    `postId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Redirect_source_key`(`source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `group` VARCHAR(50) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Setting_group_idx`(`group`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnalyticsEvent` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `path` VARCHAR(500) NOT NULL,
    `postId` VARCHAR(30) NULL,
    `visitorHash` CHAR(64) NOT NULL,
    `referrer` VARCHAR(1000) NULL,
    `utmSource` VARCHAR(191) NULL,
    `browser` VARCHAR(80) NULL,
    `os` VARCHAR(80) NULL,
    `device` VARCHAR(40) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AnalyticsEvent_createdAt_idx`(`createdAt`),
    INDEX `AnalyticsEvent_postId_createdAt_idx`(`postId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnalyticsAggregate` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `path` VARCHAR(500) NOT NULL,
    `views` INTEGER NOT NULL DEFAULT 0,
    `visitors` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `AnalyticsAggregate_date_path_key`(`date`, `path`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Backup` (
    `id` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `size` BIGINT NOT NULL,
    `status` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Backup_filename_key`(`filename`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `Admin`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `Admin`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostRevision` ADD CONSTRAINT `PostRevision_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Page` ADD CONSTRAINT `Page_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `Admin`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostTag` ADD CONSTRAINT `PostTag_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostTag` ADD CONSTRAINT `PostTag_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeriesPost` ADD CONSTRAINT `SeriesPost_seriesId_fkey` FOREIGN KEY (`seriesId`) REFERENCES `Series`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeriesPost` ADD CONSTRAINT `SeriesPost_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Comment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Navigation` ADD CONSTRAINT `Navigation_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Navigation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Redirect` ADD CONSTRAINT `Redirect_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
