import { PrismaClient } from "@prisma/client";

// Single shared instance across the process (standard Prisma dev pattern —
// avoids exhausting connections via hot-reload in dev).
export const prisma = new PrismaClient();
