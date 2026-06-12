import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const standalone = join(root, '.next', 'standalone');
if (!existsSync(standalone)) process.exit(0);
mkdirSync(join(standalone, '.next'), { recursive: true });
cpSync(join(root, '.next', 'static'), join(standalone, '.next', 'static'), { recursive: true });
cpSync(join(root, 'public'), join(standalone, 'public'), { recursive: true });
cpSync(join(root, 'scripts', 'start-standalone.mjs'), join(standalone, 'start-kuvo.mjs'));
console.log('Standalone preparado con assets públicos.');
