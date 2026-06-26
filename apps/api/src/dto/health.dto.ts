import type {
  DependencyCheck,
  MigrationCheck,
  ReadinessChecks,
} from '@aairp/domain';
import type { LivenessResult, ReadinessResult } from '@aairp/application';

export type HealthResponseDto = {
  status: 'ok';
  service: string;
  version: string;
  timestamp: string;
};

export type DependencyCheckDto = {
  status: 'up' | 'down';
  latency_ms?: number;
  error?: string;
};

export type MigrationCheckDto = DependencyCheckDto & {
  schema_version?: string;
  latest_migration?: string;
};

export type ReadinessChecksDto = {
  database: DependencyCheckDto;
  cache: DependencyCheckDto;
  migration: MigrationCheckDto;
};

export type ReadyResponseDto = {
  status: 'ready';
  timestamp: string;
  checks?: ReadinessChecksDto;
};

export function toHealthResponseDto(result: LivenessResult): HealthResponseDto {
  return {
    status: result.status,
    service: result.service,
    version: result.version,
    timestamp: result.timestamp,
  };
}

function toDependencyCheckDto(check: DependencyCheck): DependencyCheckDto {
  return {
    status: check.status,
    ...(check.latencyMs !== undefined ? { latency_ms: check.latencyMs } : {}),
    ...(check.error !== undefined ? { error: check.error } : {}),
  };
}

function toMigrationCheckDto(check: MigrationCheck): MigrationCheckDto {
  return {
    ...toDependencyCheckDto(check),
    ...(check.schemaVersion !== undefined
      ? { schema_version: check.schemaVersion }
      : {}),
    ...(check.latestMigration !== undefined
      ? { latest_migration: check.latestMigration }
      : {}),
  };
}

export function toReadinessChecksDto(checks: ReadinessChecks): ReadinessChecksDto {
  return {
    database: toDependencyCheckDto(checks.database),
    cache: toDependencyCheckDto(checks.cache),
    migration: toMigrationCheckDto(checks.migration),
  };
}

export function toReadyResponseDto(
  result: ReadinessResult,
  verbose: boolean,
): ReadyResponseDto {
  const response: ReadyResponseDto = {
    status: 'ready',
    timestamp: result.timestamp,
  };

  if (verbose) {
    response.checks = toReadinessChecksDto(result.checks);
  }

  return response;
}
