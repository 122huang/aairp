export type LlmGatewayCompleteResult = {
  content: string;
  /** Concrete model id used for this completion (provider-specific string). */
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export type LlmGatewayCompleteOptions = {
  imageUrl?: string;
  imageBase64?: string;
};

export interface ILlmGateway {
  complete(prompt: string, options?: LlmGatewayCompleteOptions): Promise<LlmGatewayCompleteResult>;
}
