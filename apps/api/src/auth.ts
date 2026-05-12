import { betterAuth } from 'better-auth';
import { Database } from 'bun:sqlite';
import path from 'path';

const dbPath = path.join(__dirname, '../../argus-auth.db');
const db = new Database(dbPath);

export const auth = betterAuth({
  database: db,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:4000/api/v1/auth',
  trustedOrigins: ['http://localhost:3000'],
  emailAndPassword: {
    enabled: true,
  },
});
