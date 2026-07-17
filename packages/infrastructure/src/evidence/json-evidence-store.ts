import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  AttachEvidenceInput,
  ConfirmEvidenceLinkInput,
  CreateEvidenceInput,
  EvidenceRecord,
  FindingEvidenceLink,
  IEvidenceStore,
  UpdateEvidenceLinkInput,
} from '@aairp/shared-kernel';
import { migrateLinkStatus } from '@aairp/shared-kernel';

export type JsonEvidenceStoreConfig = {
  rootPath: string;
};

type EvidenceManifest = {
  schema_version: string;
  updated_at: string;
  evidence_ids: string[];
};

type LinkManifest = {
  schema_version: string;
  updated_at: string;
  link_ids: string[];
};

export class JsonEvidenceStore implements IEvidenceStore {
  constructor(private readonly config: JsonEvidenceStoreConfig) {}

  private evidenceDir(): string {
    return join(this.config.rootPath, 'evidence');
  }

  private linksDir(): string {
    return join(this.config.rootPath, 'links');
  }

  async createEvidence(input: CreateEvidenceInput): Promise<EvidenceRecord> {
    const evidenceId = `ev_${randomUUID()}`;
    const storagePath = join('files', evidenceId, input.file.filename);
    const absoluteFilePath = join(this.config.rootPath, storagePath);
    await mkdir(dirname(absoluteFilePath), { recursive: true });

    const content = Buffer.from(input.file.content_base64, 'base64');
    await writeFile(absoluteFilePath, content);

    const record: EvidenceRecord = {
      evidence_id: evidenceId,
      title: input.title.trim(),
      evidence_source_type: input.evidence_source_type,
      issuing_institution: input.issuing_institution?.trim() || undefined,
      issued_date: input.issued_date || undefined,
      valid_until: input.valid_until || undefined,
      scope: input.scope ?? {},
      claim_risk_types: input.claim_risk_types ?? [],
      file: {
        filename: input.file.filename,
        mime_type: input.file.mime_type,
        storage_path: storagePath.replace(/\\/g, '/'),
      },
      created_at: new Date().toISOString(),
    };

    const evidencePath = join(this.evidenceDir(), `${evidenceId}.json`);
    await mkdir(this.evidenceDir(), { recursive: true });
    await writeFile(evidencePath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    await this.appendEvidenceManifest(evidenceId);
    return record;
  }

  async findEvidenceById(evidenceId: string): Promise<EvidenceRecord | null> {
    try {
      const raw = await readFile(join(this.evidenceDir(), `${evidenceId}.json`), 'utf8');
      return JSON.parse(raw) as EvidenceRecord;
    } catch {
      return null;
    }
  }

  async attachToFinding(input: AttachEvidenceInput): Promise<FindingEvidenceLink> {
    const evidence = await this.findEvidenceById(input.evidence_id);
    if (!evidence) {
      throw new Error(`Evidence not found: ${input.evidence_id}`);
    }

    const linkId = `fel_${randomUUID()}`;
    const link: FindingEvidenceLink = {
      link_id: linkId,
      case_id: input.case_id ?? input.review_id,
      review_id: input.review_id,
      finding_id: input.finding_id,
      evidence_id: input.evidence_id,
      status: 'AI_PENDING',
      created_at: new Date().toISOString(),
    };

    await mkdir(this.linksDir(), { recursive: true });
    await this.writeLink(link);
    await this.appendLinkManifest(linkId);
    return link;
  }

  async updateLink(input: UpdateEvidenceLinkInput): Promise<FindingEvidenceLink> {
    const link = await this.findLinkById(input.link_id);
    if (!link) throw new Error(`Link not found: ${input.link_id}`);
    const updated: FindingEvidenceLink = {
      ...link,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.ai_judgment !== undefined ? { ai_judgment: input.ai_judgment } : {}),
      ...(input.override_reason !== undefined ? { override_reason: input.override_reason } : {}),
      ...(input.confirmed_at !== undefined ? { confirmed_at: input.confirmed_at } : {}),
    };
    await this.writeLink(updated);
    return updated;
  }

  async findLinkById(linkId: string): Promise<FindingEvidenceLink | null> {
    try {
      const raw = await readFile(join(this.linksDir(), `${linkId}.json`), 'utf8');
      return migrateLinkStatus(JSON.parse(raw) as FindingEvidenceLink);
    } catch {
      return null;
    }
  }

  async listLinksForFinding(reviewId: string, findingId: string): Promise<FindingEvidenceLink[]> {
    const links = await this.listAllLinks();
    return links.filter((l) => l.review_id === reviewId && l.finding_id === findingId);
  }

  async listLinksForReview(reviewId: string): Promise<FindingEvidenceLink[]> {
    const links = await this.listAllLinks();
    return links.filter((l) => l.review_id === reviewId);
  }

  async confirmLink(input: ConfirmEvidenceLinkInput): Promise<FindingEvidenceLink> {
    const link = await this.findLinkById(input.link_id);
    if (!link) throw new Error(`Link not found: ${input.link_id}`);

    if (input.action === 'confirm') {
      link.status = 'HUMAN_CONFIRMED';
      link.confirmed_at = new Date().toISOString();
    } else if (input.action === 'override_accept') {
      if (!input.override_reason?.trim()) {
        throw new Error('override_reason is required when overriding AI insufficient/none to accept');
      }
      link.status = 'HUMAN_OVERRODE';
      link.override_reason = input.override_reason.trim();
      link.confirmed_at = new Date().toISOString();
    } else {
      link.status = 'HUMAN_OVERRODE';
      link.override_reason = input.override_reason?.trim() || undefined;
      link.confirmed_at = new Date().toISOString();
    }

    await this.writeLink(link);
    return link;
  }

  async readEvidenceFile(storagePath: string): Promise<Buffer> {
    return readFile(join(this.config.rootPath, storagePath));
  }

  private async writeLink(link: FindingEvidenceLink): Promise<void> {
    await writeFile(join(this.linksDir(), `${link.link_id}.json`), `${JSON.stringify(link, null, 2)}\n`, 'utf8');
  }

  private async listAllLinks(): Promise<FindingEvidenceLink[]> {
    const manifest = await this.readLinkManifest();
    const links: FindingEvidenceLink[] = [];
    for (const linkId of manifest.link_ids) {
      const link = await this.findLinkById(linkId);
      if (link) links.push(link);
    }
    return links;
  }

  private async readEvidenceManifest(): Promise<EvidenceManifest> {
    try {
      const raw = await readFile(join(this.config.rootPath, 'evidence-manifest.json'), 'utf8');
      return JSON.parse(raw) as EvidenceManifest;
    } catch {
      return { schema_version: '1.0.0', updated_at: new Date().toISOString(), evidence_ids: [] };
    }
  }

  private async appendEvidenceManifest(evidenceId: string): Promise<void> {
    const manifest = await this.readEvidenceManifest();
    if (!manifest.evidence_ids.includes(evidenceId)) {
      manifest.evidence_ids.push(evidenceId);
    }
    manifest.updated_at = new Date().toISOString();
    await writeFile(
      join(this.config.rootPath, 'evidence-manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );
  }

  private async readLinkManifest(): Promise<LinkManifest> {
    try {
      const raw = await readFile(join(this.config.rootPath, 'link-manifest.json'), 'utf8');
      return JSON.parse(raw) as LinkManifest;
    } catch {
      return { schema_version: '1.0.0', updated_at: new Date().toISOString(), link_ids: [] };
    }
  }

  private async appendLinkManifest(linkId: string): Promise<void> {
    const manifest = await this.readLinkManifest();
    if (!manifest.link_ids.includes(linkId)) {
      manifest.link_ids.push(linkId);
    }
    manifest.updated_at = new Date().toISOString();
    await writeFile(
      join(this.config.rootPath, 'link-manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );
  }
}
