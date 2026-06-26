import type { DependencyCheck, MigrationCheck } from '../health/dependency-check.js';

export interface IHealthRepository {
  pingDatabase(): Promise<DependencyCheck>;
  pingCache(): Promise<DependencyCheck>;
  getMigrationStatus(): Promise<MigrationCheck>;
}
