-- CreateTable
CREATE TABLE `liara_session_connections` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(255) NOT NULL,
    `tokenCiphertext` TEXT NOT NULL,
    `encryptionIv` VARCHAR(64) NOT NULL,
    `encryptionAuthTag` VARCHAR(64) NOT NULL,
    `tokenFingerprint` VARCHAR(64) NOT NULL,
    `teamId` VARCHAR(191) NOT NULL,
    `lastValidatedAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `liara_session_connections_sessionId_key`(`sessionId`),
    INDEX `liara_session_connections_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
