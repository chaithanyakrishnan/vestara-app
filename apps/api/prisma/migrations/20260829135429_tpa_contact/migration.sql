-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlanContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "org" TEXT,
    "title" TEXT,
    "fiduciaryRole" TEXT,
    CONSTRAINT "PlanContact_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlanContact" ("email", "fiduciaryRole", "id", "name", "org", "phone", "planId", "title", "type") SELECT "email", "fiduciaryRole", "id", "name", "org", "phone", "planId", "title", "type" FROM "PlanContact";
DROP TABLE "PlanContact";
ALTER TABLE "new_PlanContact" RENAME TO "PlanContact";
CREATE UNIQUE INDEX "PlanContact_planId_type_key" ON "PlanContact"("planId", "type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
