export type LlmGatewayCompleteResult = {
  content: string;
};

export interface ILlmGateway {
  complete(prompt: string): Promise<LlmGatewayCompleteResult>;
}
