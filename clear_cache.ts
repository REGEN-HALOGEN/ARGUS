import { invalidateCache } from './packages/cache/src/cache';
async function run() {
  await invalidateCache('tenant:*:threat-actors:*');
  console.log('Cache cleared');
  process.exit(0);
}
run();
