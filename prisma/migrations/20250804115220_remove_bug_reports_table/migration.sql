/*
  Warnings:

  - You are about to drop the `bug_report` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."bug_report" DROP CONSTRAINT "bug_report_reporterId_fkey";

-- DropTable
DROP TABLE "public"."bug_report";

-- DropEnum
DROP TYPE "public"."BugReportPriority";

-- DropEnum
DROP TYPE "public"."BugReportStatus";
