import { PrismaClient } from '@prisma/client';

// Singleton pattern to avoid creating multiple Prisma instances in dev (watch mode)
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  });

if (process.env.NODE_ENV === 'development') {
  globalForPrisma.prisma = prisma;
}
