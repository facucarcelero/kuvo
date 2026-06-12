import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
for (const envFile of ['.env.local', '.env']) {
  const path = join(root, envFile);
  if (existsSync(path)) { process.loadEnvFile(path); break; }
}
const server = join(root, '.next', 'standalone', 'server.js');
const child = spawn(process.execPath, [server], {
  stdio: 'inherit',
  env: { ...process.env, HOSTNAME: process.env.KUVO_HOST || '0.0.0.0' },
});
child.on('exit', code => process.exit(code ?? 0));
