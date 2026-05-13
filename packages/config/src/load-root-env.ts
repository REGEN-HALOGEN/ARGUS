import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let loaded = false;

function findEnvPath(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, '.env');
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return null;
}

export function loadRootEnv(): void {
  if (loaded) {
    return;
  }
  loaded = true;

  const envPath = findEnvPath();
  if (!envPath) {
    return;
  }

  try {
    const envContent = readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) {
        continue;
      }
      const key = trimmed.substring(0, eqIdx).trim();
      const value = trimmed.substring(eqIdx + 1).trim();
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // ignore missing or unreadable .env
  }
}
