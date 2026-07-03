#!/usr/bin/env node
/**
 * Sprint 6B-1h — offline CI runner for rewrite-quality-v1 benchmark (stub mode).
 */
import {
  formatRewriteQualityBenchmarkSummary,
  loadRewriteQualityManifest,
  runRewriteQualityBenchmark,
} from '../packages/application/dist/evaluation/rewrite-quality-benchmark.js';

process.env.AAIRP_REWRITE_MODE = process.env.AAIRP_REWRITE_MODE ?? 'stub';

const manifest = loadRewriteQualityManifest();
const report = await runRewriteQualityBenchmark(manifest);

console.log(formatRewriteQualityBenchmarkSummary(report));

if (report.failed > 0) {
  process.exitCode = 1;
}
