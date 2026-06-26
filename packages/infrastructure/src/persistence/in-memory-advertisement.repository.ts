import type {
  IAdvertisementRepository,
  NormalizedAdvertisement,
} from '@aairp/domain';

export class InMemoryAdvertisementRepository implements IAdvertisementRepository {
  private readonly store = new Map<string, NormalizedAdvertisement>();

  async save(advertisement: NormalizedAdvertisement): Promise<NormalizedAdvertisement> {
    this.store.set(advertisement.advertisementId, advertisement);
    return advertisement;
  }

  async findById(advertisementId: string): Promise<NormalizedAdvertisement | null> {
    return this.store.get(advertisementId) ?? null;
  }
}
