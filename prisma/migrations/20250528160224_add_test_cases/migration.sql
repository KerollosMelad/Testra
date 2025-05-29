-- CreateEnum
CREATE TYPE "TestType" AS ENUM ('UNIT', 'INTEGRATION', 'E2E', 'API');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "GeneratedBy" AS ENUM ('AI', 'MANUAL');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('COVERS', 'VALIDATES', 'DEPENDS_ON');

-- CreateEnum
CREATE TYPE "SuiteType" AS ENUM ('SMOKE', 'REGRESSION', 'INTEGRATION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TestCaseRelationType" AS ENUM ('PREREQUISITE', 'FOLLOWS', 'BLOCKS');

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "TestType" NOT NULL,
    "priority" "Priority" NOT NULL,
    "status" "TestStatus" NOT NULL DEFAULT 'DRAFT',
    "steps" JSONB NOT NULL,
    "expectedResult" TEXT NOT NULL,
    "preconditions" TEXT,
    "testData" JSONB,
    "estimatedDuration" INTEGER,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3),
    "generatedBy" "GeneratedBy",
    "generatedCode" TEXT,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCaseWorkItemRelation" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "relationType" "RelationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestCaseWorkItemRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSuite" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "SuiteType" NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestSuite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSuiteItem" (
    "id" TEXT NOT NULL,
    "testSuiteId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestSuiteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCaseRelation" (
    "id" TEXT NOT NULL,
    "parentTestCaseId" TEXT NOT NULL,
    "childTestCaseId" TEXT NOT NULL,
    "relationType" "TestCaseRelationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestCaseRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestCase_projectId_idx" ON "TestCase"("projectId");

-- CreateIndex
CREATE INDEX "TestCase_type_idx" ON "TestCase"("type");

-- CreateIndex
CREATE INDEX "TestCase_status_idx" ON "TestCase"("status");

-- CreateIndex
CREATE INDEX "TestCaseWorkItemRelation_workItemId_idx" ON "TestCaseWorkItemRelation"("workItemId");

-- CreateIndex
CREATE UNIQUE INDEX "TestCaseWorkItemRelation_testCaseId_workItemId_relationType_key" ON "TestCaseWorkItemRelation"("testCaseId", "workItemId", "relationType");

-- CreateIndex
CREATE INDEX "TestSuite_projectId_idx" ON "TestSuite"("projectId");

-- CreateIndex
CREATE INDEX "TestSuiteItem_testSuiteId_idx" ON "TestSuiteItem"("testSuiteId");

-- CreateIndex
CREATE UNIQUE INDEX "TestSuiteItem_testSuiteId_testCaseId_key" ON "TestSuiteItem"("testSuiteId", "testCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "TestCaseRelation_parentTestCaseId_childTestCaseId_relationT_key" ON "TestCaseRelation"("parentTestCaseId", "childTestCaseId", "relationType");

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseWorkItemRelation" ADD CONSTRAINT "TestCaseWorkItemRelation_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSuite" ADD CONSTRAINT "TestSuite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSuiteItem" ADD CONSTRAINT "TestSuiteItem_testSuiteId_fkey" FOREIGN KEY ("testSuiteId") REFERENCES "TestSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSuiteItem" ADD CONSTRAINT "TestSuiteItem_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseRelation" ADD CONSTRAINT "TestCaseRelation_parentTestCaseId_fkey" FOREIGN KEY ("parentTestCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseRelation" ADD CONSTRAINT "TestCaseRelation_childTestCaseId_fkey" FOREIGN KEY ("childTestCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
