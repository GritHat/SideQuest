import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const DEMO_PASSWORD = 'Password123!';

const DEMO_USERS: Array<{
  username: string;
  email: string;
  role: Role;
}> = [
  { username: 'admin', email: 'admin@sidequest.local', role: Role.ADMIN },
  { username: 'moderator', email: 'moderator@sidequest.local', role: Role.MODERATOR },
  { username: 'author', email: 'author@sidequest.local', role: Role.USER },
  { username: 'explorer', email: 'explorer@sidequest.local', role: Role.USER },
];

async function main() {
  const passwordHash = await argon2.hash(DEMO_PASSWORD);

  for (const account of DEMO_USERS) {
    await prisma.user.upsert({
      where: { email: account.email },
      create: {
        username: account.username,
        email: account.email,
        passwordHash,
        emailVerified: true,
        role: account.role,
        status: UserStatus.ACTIVE,
      },
      update: {
        username: account.username,
        role: account.role,
        status: UserStatus.ACTIVE,
      },
    });
  }

  console.log('Seeded demo accounts: admin, moderator, author, explorer');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
