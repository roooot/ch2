-- CreateTable
CREATE TABLE `documents` (
    `id` VARCHAR(191) NOT NULL,
    `sourceUrl` VARCHAR(768) NOT NULL,
    `sourcePath` VARCHAR(1024) NULL,
    `title` VARCHAR(512) NOT NULL,
    `category` VARCHAR(255) NULL,
    `contentHash` VARCHAR(64) NOT NULL,
    `rawContent` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `documents_category_idx`(`category`),
    UNIQUE INDEX `documents_sourceUrl_key`(`sourceUrl`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chunks` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `chunkIndex` INTEGER NOT NULL,
    `tokenCount` INTEGER NOT NULL DEFAULT 0,
    `embedding` JSON NULL,
    `embeddingDim` INTEGER NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chunks_documentId_idx`(`documentId`),
    FULLTEXT INDEX `chunks_content_idx`(`content`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversations` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(255) NOT NULL,
    `title` VARCHAR(255) NULL,
    `agentState` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `conversations_sessionId_idx`(`sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messages` (
    `id` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'ASSISTANT', 'SYSTEM') NOT NULL,
    `content` LONGTEXT NOT NULL,
    `intent` VARCHAR(64) NULL,
    `thinkingSteps` JSON NULL,
    `citations` JSON NULL,
    `suggestedActions` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `messages_conversationId_idx`(`conversationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feedback` (
    `id` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `rating` ENUM('UP', 'DOWN') NOT NULL,
    `comment` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `feedback_messageId_key`(`messageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `query_cache` (
    `id` VARCHAR(191) NOT NULL,
    `queryHash` VARCHAR(64) NOT NULL,
    `query` TEXT NOT NULL,
    `response` LONGTEXT NOT NULL,
    `citations` JSON NULL,
    `hitCount` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `query_cache_expiresAt_idx`(`expiresAt`),
    UNIQUE INDEX `query_cache_queryHash_key`(`queryHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `api_logs` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(255) NULL,
    `conversationId` VARCHAR(255) NULL,
    `route` VARCHAR(255) NOT NULL,
    `intent` VARCHAR(64) NULL,
    `model` VARCHAR(128) NULL,
    `promptTokens` INTEGER NULL DEFAULT 0,
    `completionTokens` INTEGER NULL DEFAULT 0,
    `latencyMs` INTEGER NULL DEFAULT 0,
    `cacheHit` BOOLEAN NOT NULL DEFAULT false,
    `statusCode` INTEGER NULL DEFAULT 200,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `api_logs_createdAt_idx`(`createdAt`),
    INDEX `api_logs_route_idx`(`route`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `chunks` ADD CONSTRAINT `chunks_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feedback` ADD CONSTRAINT `feedback_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
