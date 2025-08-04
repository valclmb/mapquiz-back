/*
  Warnings:

  - You are about to drop the column `lastActivityAt` on the `game_lobby` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."BugReportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."BugReportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterTable
ALTER TABLE "public"."game_lobby" DROP COLUMN "lastActivityAt";

-- CreateTable
CREATE TABLE "public"."bug_report" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "stepsToReproduce" TEXT,
    "location" TEXT,
    "environment" JSONB NOT NULL,
    "userAgent" TEXT,
    "url" TEXT,
    "status" "public"."BugReportStatus" NOT NULL DEFAULT 'OPEN',
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "analysis" TEXT,
    "solution" TEXT,
    "resolutionNotes" TEXT,
    "reporterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bug_report_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."bug_report" ADD CONSTRAINT "bug_report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
