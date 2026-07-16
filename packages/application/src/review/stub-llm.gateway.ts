import { readFileSync } from 'node:fs';
import type { ILlmGateway, LlmGatewayCompleteResult } from './stub-llm.gateway.types.js';

export type { ILlmGateway, LlmGatewayCompleteResult } from './stub-llm.gateway.types.js';

export type StubLlmGatewayConfig = {
  responsePath: string;
  readTextFile?: (path: string) => string;
};

export class StubLlmGateway implements ILlmGateway {
  constructor(private readonly config: StubLlmGatewayConfig) {}

  async complete(_prompt: string): Promise<LlmGatewayCompleteResult> {
    const readTextFile = this.config.readTextFile ?? ((path: string) => readFileSync(path, 'utf8'));
    return { content: readTextFile(this.config.responsePath), model: 'stub' };
  }
}
