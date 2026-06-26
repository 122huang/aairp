import type { NormalizedAdvertisement } from '../advertisement/advertisement.types.js';

export interface IAdvertisementRepository {
  save(advertisement: NormalizedAdvertisement): Promise<NormalizedAdvertisement>;
  findById(advertisementId: string): Promise<NormalizedAdvertisement | null>;
}
