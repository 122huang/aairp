export type DependencyStatus = 'up' | 'down';

export type DependencyCheck = {
  status: DependencyStatus;
  latencyMs?: number;
  error?: string;
};

export type MigrationCheck = DependencyCheck & {
  schemaVersion?: string;
  latestMigration?: string;
};

export type ReadinessChecks = {
  database: DependencyCheck;
  cache: DependencyCheck;
  migration: MigrationCheck;
};

export function isDependencyReady(check: DependencyCheck): boolean {
  return check.status === 'up';
}

export function areAllReadinessChecksReady(checks: ReadinessChecks): boolean {
  return (
    isDependencyReady(checks.database) &&
    isDependencyReady(checks.cache) &&
    isDependencyReady(checks.migration)
  );
}
