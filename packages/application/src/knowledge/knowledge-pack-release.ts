import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assembleKnowledgePackDraft } from './knowledge-pack-assembler.js';
import { validateKnowledgePack, validateReleaseMutation } from './knowledge-pack-validator.js';
import {
  knowledgePackDir,
  knowledgePackDraftPath,
  knowledgePackReleasePath,
  knowledgePackReleasesDir,
  loadKnowledgePackDraft,
  resolveKnowledgePackManifestPath,
  type KnowledgePackV2,
} from './knowledge-pack.js';

export function writeKnowledgePackDraft(pack: KnowledgePackV2): KnowledgePackV2 {
  const dir = join(knowledgePackDir(), 'drafts');
  mkdirSync(dir, { recursive: true });
  writeFileSync(knowledgePackDraftPath(), `${JSON.stringify(pack, null, 2)}\n`);
  return pack;
}

export function assembleAndWriteDraft(options?: {
  now?: Date;
  supersedes?: string;
}): KnowledgePackV2 {
  const draft = assembleKnowledgePackDraft({
    now: options?.now,
    release_status: 'draft',
    supersedes: options?.supersedes,
  });
  return writeKnowledgePackDraft(draft);
}

export function markPackValidated(pack: KnowledgePackV2): KnowledgePackV2 {
  const validated: KnowledgePackV2 = {
    ...pack,
    release_status: 'validated',
  };
  return writeKnowledgePackDraft(validated);
}

export function writeReleasedPackPointer(pack: KnowledgePackV2): void {
  const pointer = resolveKnowledgePackManifestPath();
  writeFileSync(pointer, `${JSON.stringify(pack, null, 2)}\n`);
}

export function releaseKnowledgePack(options: {
  released_by: string;
  now?: Date;
  supersedes?: string;
  draft?: KnowledgePackV2;
}): KnowledgePackV2 {
  const now = options.now ?? new Date();
  const draft =
    options.draft ??
    loadKnowledgePackDraft() ??
    assembleKnowledgePackDraft({
      now,
      release_status: 'validated',
      supersedes: options.supersedes,
    });

  const validation = validateKnowledgePack({ ...draft, release_status: 'validated' }, { now });
  if (!validation.passed) {
    throw new Error(
      `Knowledge Pack validation failed with ${validation.error_count} error(s); cannot release`,
    );
  }

  const existing = loadReleasedPackIfExists(draft.knowledge_pack_id);
  const mutationIssues = validateReleaseMutation(draft.knowledge_pack_id, existing);
  if (mutationIssues.length > 0) {
    throw new Error(mutationIssues[0]!.message);
  }

  const released: KnowledgePackV2 = {
    ...draft,
    release_status: 'released',
    released_at: now.toISOString(),
    released_by: options.released_by,
  };

  mkdirSync(knowledgePackReleasesDir(), { recursive: true });
  const releasePath = knowledgePackReleasePath(released.knowledge_pack_id);
  if (existsSync(releasePath)) {
    throw new Error(`Release file already exists: ${released.knowledge_pack_id}`);
  }

  writeFileSync(releasePath, `${JSON.stringify(released, null, 2)}\n`);
  writeReleasedPackPointer(released);
  writeKnowledgePackDraft(released);
  return released;
}

function loadReleasedPackIfExists(packId: string): KnowledgePackV2 | null {
  const path = knowledgePackReleasePath(packId);
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, 'utf8')) as KnowledgePackV2;
}

export function listReleasedPackIds(): string[] {
  const dir = knowledgePackReleasesDir();
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, ''))
    .sort();
}
