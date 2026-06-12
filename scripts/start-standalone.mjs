import { existsSync } from 'node:fs';
for (const envFile of ['.env.local', '.env']) {
  if (existsSync(envFile)) { process.loadEnvFile(envFile); break; }
}
process.env.HOSTNAME = process.env.KUVO_HOST || '0.0.0.0';
await import('./server.js');
