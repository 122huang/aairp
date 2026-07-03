export type LlmGatewayCompleteResult = {
  content: string;
};

export type LlmGatewayCompleteOptions = {
  imageUrl?: string;
  imageBase64?: string;
};

export interface ILlmGateway {
  complete(prompt: string, options?: LlmGatewayCompleteOptions): Promise<LlmGatewayCompleteResult>;
}
