import { PrismaClient } from '@prisma/client';
import { parseEnv } from '@repo/env';
import { baseEnvSchema } from '@repo/env';

let prisma: PrismaClient | null = null;

/**
 * Initialize Prisma Client with proper error handling
 * Fails fast if database connection cannot be established
 */
export const initDb = async(): Promise<void> =>{
  if(prisma) return;

  const env = parseEnv(baseEnvSchema);
  try{
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['info', 'warn', 'error'] : ['error'],
    })

    await prisma.$queryRaw`SELECT 1`;
    console.log('Database connection established');
  }catch(error){
    await prisma?.$disconnect();
    prisma= null;
    throw new Error(`Failed to connect to Postgres: ${(error as Error).message}`);
  }
  
}

export const getDb = (): PrismaClient => {
  if (!prisma) throw new Error('Prisma client not initialized. Call initDb() first.');
  return prisma;
};

/**
 * Health check: verify database connectivity
 */
export const checkDbHealth = async (): Promise<{ ok: true } | { ok: false; error: string }> => {
  try {
    await getDb().$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

/**
 * Gracefully shutdown database connection
 */
export const shutdownDb = async (): Promise<void> => {
  if (!prisma) return;

  const currentPrisma = prisma;
  prisma = null;
  await currentPrisma.$disconnect();
  console.log('Database connection closed');
};

export { PrismaClient } from '@prisma/client';
export type { Prisma } from '@prisma/client';
