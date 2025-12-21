import { z } from 'zod';

/**
 * Shared environment schema for all apps and packages
 * Extend this for app-specific variables
 */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

/**
 * Database configuration
 */
export const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
});

/**
 * Redis configuration
 */
export const redisEnvSchema = z.object({
  REDIS_URL: z.string().url(),
});

/**
 * Authentication configuration
 */
export const authEnvSchema = z.object({
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRATION: z.string().default('24h'),
});

/**
 * API configuration
 */
export const apiEnvSchema = z.object({
  API_PORT: z.coerce.number().default(3000),
  API_HOST: z.string().default('0.0.0.0'),
});

/**
 * WebSocket configuration
 */
export const wsEnvSchema = z.object({
  WS_PORT: z.coerce.number().default(3001),
  WS_HOST: z.string().default('0.0.0.0'),
});

/**
 * Trading configuration
 */
export const tradingEnvSchema = z.object({
  MAX_LEVERAGE: z.coerce.number().default(10),
  MIN_POSITION_SIZE: z.coerce.number().default(0.01),
});

/**
 * Parse and validate environment variables
 */
export function parseEnv <T extends z.ZodType> (schema: T) :z.infer<T>{
  try{
    return schema.parse(process.env);
  }catch(error){
    if(error instanceof z.ZodError){
      const issues =  error.errors.map((e)=> `- ${e.path.join('.')}: ${e.message}`).join('\n');
      throw new Error(`Environment validation failed:\n${issues}`);
    }
    throw error;
  }
} 
/**
 * Combined schema for full app initialization
 */
export const createAppEnvSchema = (overrides?: z.ZodObject<any, any, any>) => {
  const schema = baseEnvSchema
    .merge(databaseEnvSchema)
    .merge(redisEnvSchema)
    .merge(authEnvSchema)
    .merge(apiEnvSchema);

  return overrides ? schema.merge(overrides) : schema;
};

export default {
  baseEnvSchema,
  databaseEnvSchema,
  redisEnvSchema,
  authEnvSchema,
  apiEnvSchema,
  wsEnvSchema,
  tradingEnvSchema,
  parseEnv,
  createAppEnvSchema,
};
