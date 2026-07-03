import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ILlmGateway, LlmGatewayCompleteResult } from './stub-llm.gateway.types.js';

const defaultStubRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../benchmark/fixtures/image-compliance/stubs',
);
const defaultFallbackStubPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/vision.stub.json',
);

const imageUrlPromptPattern = /Image URL:\s*(\S+)/;

export function extractImageUrlFromVisionPrompt(prompt: string): string | undefined {
  const match = prompt.match(imageUrlPromptPattern);
  return match?.[1];
}

export function resolveVisionScenarioStubPath(
  imageUrl: string | undefined,
  stubRoot = defaultStubRoot,
): string | undefined {
  if (!imageUrl) {
    return undefined;
  }

  const fileName = basename(imageUrl).replace(/\.[a-z0-9]+$/i, '');
  const candidate = join(stubRoot, `${fileName}.json`);
  if (existsSync(candidate)) {
    return candidate;
  }

  return undefined;
}

export class VisionScenarioStubGateway implements ILlmGateway {
  constructor(
    private readonly config: {
      stubRoot?: string;
      fallbackStubPath?: string;
      readTextFile?: (path: string) => string;
    } = {},
  ) {}

  async complete(prompt: string): Promise<LlmGatewayCompleteResult> {
    const readTextFile = this.config.readTextFile ?? ((path: string) => readFileSync(path, 'utf8'));
    const stubRoot = this.config.stubRoot ?? defaultStubRoot;
    const fallbackStubPath = this.config.fallbackStubPath ?? defaultFallbackStubPath;
    const imageUrl = extractImageUrlFromVisionPrompt(prompt);
    const scenarioStubPath = resolveVisionScenarioStubPath(imageUrl, stubRoot);
    const responsePath = scenarioStubPath ?? fallbackStubPath;

    return { content: readTextFile(responsePath) };
  }
}
