// Usage: npm run hash-password -- "your-admin-password"
import { randomBytes, scryptSync } from 'node:crypto';

const password = process.argv[2];
if (!password || password.length < 8) {
  console.error('Usage: npm run hash-password -- "<password of at least 8 characters>"');
  process.exit(1);
}

const salt = randomBytes(16).toString('hex');
const hash = scryptSync(password, salt, 64).toString('hex');

console.log('\nAdd these to your .env file (and to Vercel Environment Variables):\n');
console.log(`ADMIN_PASSWORD_HASH=${salt}:${hash}`);
console.log(`SESSION_SECRET=${randomBytes(32).toString('hex')}\n`);
