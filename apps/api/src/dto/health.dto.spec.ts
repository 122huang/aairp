import { describe, expect, it } from 'vitest';
import type { ReadinessResult } from '@aairp/application';
import {
  toHealthResponseDto,
  toReadyResponseDto,
  toReadinessChecksDto,
} from './health.dto.js';

describe('health DTO mappers', () => {
  const readinessResult: ReadinessResult = {
    status: 'ready',
    timestamp: '2026-06-26T10:00:00.000Z',
    checks: {
      database: { status: 'up', latencyMs: 3 },
      cache: { status: 'up', latencyMs: 1 },
      migration: {
        status: 'up',
        latencyMs: 2,
        schemaVersion: '1.0.0',
        latestMigration: 'V1.0.0__grants',
      },
    },
  };

  it('toHealthResponseDto maps liveness fields', () => {
    expect(
      toHealthResponseDto({
        status: 'ok',
        service: 'aairp-api',
        version: '0.1.0-sprint1',
        timestamp: '2026-06-26T10:00:00.000Z',
      }),
    ).toEqual({
      status: 'ok',
      service: 'aairp-api',
      version: '0.1.0-sprint1',
      timestamp: '2026-06-26T10:00:00.000Z',
    });
  });

  it('toReadyResponseDto omits checks when verbose is false', () => {
    expect(toReadyResponseDto(readinessResult, false)).toEqual({
      status: 'ready',
      timestamp: '2026-06-26T10:00:00.000Z',
    });
  });

  it('toReadinessChecksDto uses snake_case API fields', () => {
    expect(toReadinessChecksDto(readinessResult.checks)).toEqual({
      database: { status: 'up', latency_ms: 3 },
      cache: { status: 'up', latency_ms: 1 },
      migration: {
        status: 'up',
        latency_ms: 2,
        schema_version: '1.0.0',
        latest_migration: 'V1.0.0__grants',
      },
    });
  });
});
