require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const departments = [
    { name: 'Software Engineering', slug: 'software' },
    { name: 'Computer Science', slug: 'computer_science' },
    { name: 'Cyber Security', slug: 'cyber' },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { slug: dept.slug },
      update: { name: dept.name },
      create: dept,
    });
    console.log(`✅ Seeded department: ${dept.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
