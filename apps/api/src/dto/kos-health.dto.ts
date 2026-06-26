export type KosHealthResponseDto = {
  status: 'ok';
  service: string;
  version: string;
  api_prefix: string;
  timestamp: string;
};

export function toKosHealthResponseDto(input: {
  serviceName: string;
  version: string;
  timestamp: string;
}): KosHealthResponseDto {
  return {
    status: 'ok',
    service: input.serviceName,
    version: input.version,
    api_prefix: '/kos/v1',
    timestamp: input.timestamp,
  };
}
