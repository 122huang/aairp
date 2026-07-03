import type { ReviewHappyPathResult, ReviewPipelineTimings } from '@aairp/shared-kernel';
import type { ReviewCaseSnapshot } from '@aairp/shared-kernel';
import { AdvertisementUploadService } from '../advertisement/advertisement-upload.service.js';
import { ContextBuilderService } from './context-builder.service.js';
import { ReviewPipelineService } from './review-pipeline.service.js';

export type ReviewHappyPathServiceDeps = {
  advertisementUploadService: AdvertisementUploadService;
  contextBuilderService: ContextBuilderService;
  reviewPipelineService: ReviewPipelineService;
};

export type ReviewHappyPathRunResult = ReviewHappyPathResult & {
  timings: ReviewPipelineTimings;
  /** Read-only snapshot for Case Library; not used by review logic. */
  caseSnapshot: ReviewCaseSnapshot;
};

export class ReviewHappyPathService {
  constructor(private readonly deps: ReviewHappyPathServiceDeps) {}

  async run(uploadPayload: unknown): Promise<ReviewHappyPathRunResult> {
    const advertisement = await this.deps.advertisementUploadService.upload(uploadPayload);
    const context = this.deps.contextBuilderService.buildFromAdvertisement(advertisement);
    const pipeline = await this.deps.reviewPipelineService.runThroughReport(context);

    return {
      reviewId: pipeline.report.reviewId,
      advertisementId: advertisement.advertisementId,
      decision: pipeline.decision,
      report: pipeline.report,
      timings: pipeline.timings,
      caseSnapshot: {
        context,
        ruleResult: pipeline.ruleResult,
        playbookResult: pipeline.playbookResult,
        openRiskResult: pipeline.openRiskResult,
      },
    };
  }
}
