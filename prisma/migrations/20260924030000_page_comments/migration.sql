ALTER TABLE `Comment` MODIFY `postId` VARCHAR(191) NULL;
ALTER TABLE `Comment` ADD COLUMN `pageId` VARCHAR(191) NULL;
CREATE INDEX `Comment_pageId_status_createdAt_idx` ON `Comment`(`pageId`, `status`, `createdAt`);
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `Page`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
