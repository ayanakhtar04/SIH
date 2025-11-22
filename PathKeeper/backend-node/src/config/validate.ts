import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .default('6060')
    .transform((v) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error('PORT must be an integer 1-65535');
      return n;
    }),
  JWT_SECRET: z
    .string()
    .min(12, 'JWT_SECRET must be at least 12 characters (change the default)')
    .default('dev_secret_change_me'),
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map(s => s.trim()).filter(Boolean) : []))
});

export type AppConfig = {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  JWT_SECRET: string;
  CORS_ORIGINS: string[];
};

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n');
    console.error('Configuration validation failed:\n' + issues);
    process.exit(1);
  }
  const cfg = parsed.data;
  return {
    NODE_ENV: cfg.NODE_ENV,
    PORT: cfg.PORT,
    JWT_SECRET: cfg.JWT_SECRET,
    CORS_ORIGINS: cfg.CORS_ORIGINS || []
  };
}
