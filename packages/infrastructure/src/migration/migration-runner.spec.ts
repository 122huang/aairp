import { describe, expect, it } from 'vitest';
import {
  computeChecksum,
  loadMigrationFiles,
  parseMigrationFileName,
  sortMigrationFiles,
} from './migration-runner.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

describe('migration-runner', () => {
  it('parses migration file names', () => {
    const parsed = parseMigrationFileName('V2.0.0__knowledge_tables.sql');
    expect(parsed).toMatchObject({
      version: '2.0.0',
      name: 'V2.0.0__knowledge_tables',
    });
  });

  it('sorts V1 before V2 and init_database before grants', () => {
    const names = sortMigrationFiles([
      { ...parseMigrationFileName('V2.0.0__knowledge_tables.sql')!, filePath: '' },
      { ...parseMigrationFileName('V1.0.0__grants.sql')!, filePath: '' },
      { ...parseMigrationFileName('V1.0.0__init_database.sql')!, filePath: '' },
    ]).map((f) => f.name);

    expect(names[0]).toBe('V1.0.0__init_database');
    expect(names[1]).toBe('V1.0.0__grants');
    expect(names[2]).toBe('V2.0.0__knowledge_tables');
  });

  it('loads migration files from repo directory in deterministic order', async () => {
    const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../migrations');
    const files = await loadMigrationFiles(migrationsDir);
    expect(files.length).toBeGreaterThanOrEqual(7);
    expect(files[0]?.name).toBe('V1.0.0__init_database');
    expect(files.some((f) => f.name === 'V2.0.0__knowledge_tables')).toBe(true);
    expect(files.some((f) => f.name === 'V2.0.0__audit_events')).toBe(true);
  });

  it('computes stable sha256 checksum', () => {
    const a = computeChecksum('SELECT 1;');
    const b = computeChecksum('SELECT 1;');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});
