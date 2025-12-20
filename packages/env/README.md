# @repo/env

Environment variable validation and configuration for the trading platform.

## Usage

### Basic Environment Validation

```typescript
import { parseEnv, baseEnvSchema } from '@repo/env';

const env = parseEnv(baseEnvSchema);
console.log(env.NODE_ENV); // 'development' | 'staging' | 'production'
```

### API with Full Configuration

```typescript
import { parseEnv, createAppEnvSchema, apiEnvSchema } from '@repo/env';

const env = parseEnv(
  createAppEnvSchema(apiEnvSchema)
);

console.log(env.API_PORT);    // 3000
console.log(env.DATABASE_URL); // postgres://...
console.log(env.JWT_SECRET);   // your-secret
```

### Custom Schema

```typescript
import { z } from 'zod';
import { parseEnv, baseEnvSchema, apiEnvSchema } from '@repo/env';

const customEnv = baseEnvSchema
  .merge(apiEnvSchema)
  .extend({
    CUSTOM_VAR: z.string(),
  });

const env = parseEnv(customEnv);
```

## Available Schemas

- `baseEnvSchema` - NODE_ENV, LOG_LEVEL
- `databaseEnvSchema` - DATABASE_URL
- `redisEnvSchema` - REDIS_URL
- `authEnvSchema` - JWT_SECRET, JWT_EXPIRATION
- `apiEnvSchema` - API_PORT, API_HOST
- `wsEnvSchema` - WS_PORT, WS_HOST
- `tradingEnvSchema` - MAX_LEVERAGE, MIN_POSITION_SIZE

## Error Handling

```typescript
try {
  const env = parseEnv(mySchema);
} catch (error) {
  console.error('Failed to load environment:', error.message);
  process.exit(1);
}
```

## .env Example

```env
NODE_ENV=development
LOG_LEVEL=debug
DATABASE_URL=postgresql://user:password@localhost:5432/trading
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-256-bit-secret-key-here-minimum-32-characters
API_PORT=3000
API_HOST=0.0.0.0
WS_PORT=3001
WS_HOST=0.0.0.0
MAX_LEVERAGE=10
MIN_POSITION_SIZE=0.01
```
