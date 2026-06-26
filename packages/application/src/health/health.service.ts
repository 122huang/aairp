import {
  areAllReadinessChecksReady,
  type IHealthRepository,
  type ReadinessChecks,
} from '@aairp/domain';

export type HealthServiceConfig = {
  serviceName: string;
  version: string;
  now?: () => Date;
};

export type LivenessResult = {
  status: 'ok';
  service: string;
  version: string;
  timestamp: string;
};

export type ReadinessResult = {
  status: 'ready' | 'not_ready';
  timestamp: string;
  checks: ReadinessChecks;
};

export class HealthService {
  constructor(
    private readonly repository: IHealthRepository,
    private readonly config: HealthServiceConfig,
  ) {}

  checkLiveness(): LivenessResult {
    return {
      status: 'ok',
      service: this.config.serviceName,
      version: this.config.version,
      timestamp: this.currentTimestamp(),
    };
  }

  async checkReadiness(): Promise<ReadinessResult> {
    const [database, cache, migration] = await Promise.all([
      this.repository.pingDatabase(),
      this.repository.pingCache(),
      this.repository.getMigrationStatus(),
    ]);

    const checks: ReadinessChecks = { database, cache, migration };
    const ready = areAllReadinessChecksReady(checks);

    return {
      status: ready ? 'ready' : 'not_ready',
      timestamp: this.currentTimestamp(),
      checks,
    };
  }

  private currentTimestamp(): string {
    return (this.config.now ?? (() => new Date()))().toISOString();
  }
}
