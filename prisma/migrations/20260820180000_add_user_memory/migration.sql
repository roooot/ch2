-- CreateTable
CREATE TABLE `user_memories` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(255) NOT NULL,
    `summary` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_memories_sessionId_key`(`sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
