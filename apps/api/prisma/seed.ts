import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);

  const sponsor = await prisma.user.upsert({
    where: { email: "murthy@altimetrik1.com" },
    update: {},
    create: {
      email: "murthy@altimetrik1.com",
      passwordHash,
      displayName: "Murthy (Plan Sponsor)",
      role: "sponsor",
    },
  });

  const advisor = await prisma.user.upsert({
    where: { email: "chai@lpl.com" },
    update: {},
    create: {
      email: "chai@lpl.com",
      passwordHash,
      displayName: "Chai (Advisor / TPA)",
      role: "advisor",
    },
  });

  console.log("Seeded demo users:");
  console.log(`  Sponsor: ${sponsor.email} / demo1234`);
  console.log(`  Advisor: ${advisor.email} / demo1234`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
