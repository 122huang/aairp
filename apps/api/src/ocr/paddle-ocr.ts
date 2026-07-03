import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type PaddleOcrResult = {
  text: string;
  provider: string;
  blockCount: number;
  tileCount: number;
  imageWidth: number;
  imageHeight: number;
  upscaled: boolean;
  segments: Array<{ text: string; x0: number; y0: number; x1?: number; y1?: number }>;
};

function repoRoot(): string {
  // apps/api/src/ocr -> repo root (aairp)
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
}

function defaultPythonPath(): string {
  const root = repoRoot();
  return path.join(root, '.venv-paddle', process.platform === 'win32' ? 'Scripts' : 'bin', 'python');
}

function defaultScriptPath(): string {
  const root = repoRoot();
  return path.join(root, 'scripts', 'paddle_ocr_extract.py');
}

export function isPaddleOcrEnabled(): boolean {
  const flag = process.env.PADDLE_OCR_ENABLED?.trim().toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off') return false;
  const provider = process.env.OCR_PROVIDER?.trim().toLowerCase();
  if (provider === 'paddle') return true;
  if (flag === '1' || flag === 'true' || flag === 'on') return true;
  // Auto-enable when venv python + script exist
  return fs.existsSync(defaultPythonPath()) && fs.existsSync(defaultScriptPath());
}

export async function extractTextWithPaddleOcr(imageBuffer: Buffer): Promise<PaddleOcrResult> {
  const python = process.env.PADDLE_PYTHON?.trim() || defaultPythonPath();
  const script = process.env.PADDLE_OCR_SCRIPT?.trim() || defaultScriptPath();

  if (!fs.existsSync(python)) {
    throw new Error(
      `未找到 PaddleOCR Python：${python}。请运行 scripts/setup-paddle-ocr.ps1 安装，或设置 PADDLE_PYTHON。`,
    );
  }
  if (!fs.existsSync(script)) {
    throw new Error(`未找到 PaddleOCR 脚本：${script}`);
  }

  const tmpFile = path.join(os.tmpdir(), `aairp-paddle-${Date.now()}.jpg`);
  await fs.promises.writeFile(tmpFile, imageBuffer);

  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(python, [script, tmpFile], {
        env: {
          ...process.env,
          FLAGS_use_mkldnn: '0',
          PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: 'True',
        },
        windowsHide: true,
      });

      let out = '';
      let err = '';
      child.stdout.on('data', (chunk: Buffer) => {
        out += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        err += chunk.toString();
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code !== 0 && !out.trim()) {
          reject(
            new Error(
              `PaddleOCR 失败 (exit ${code}): ${err.slice(-800) || 'no output'}`,
            ),
          );
          return;
        }
        resolve(out);
      });
    });

    const line = stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .pop();
    if (!line) {
      throw new Error('PaddleOCR 无输出');
    }

    const parsed = JSON.parse(line) as {
      ocr_text?: string;
      provider?: string;
      tile_count?: number;
      image_width?: number;
      image_height?: number;
      upscaled?: boolean;
      segment_count?: number;
      segments?: Array<{ text: string; x0: number; y0: number }>;
      error?: string;
    };

    if (parsed.error) {
      throw new Error(parsed.error);
    }

    const text = parsed.ocr_text?.trim() ?? '';
    if (!text) {
      throw new Error('PaddleOCR 未识别到文字，请换更清晰的图片或手动粘贴文案');
    }

    return {
      text,
      provider: parsed.provider ?? 'paddleocr_local',
      blockCount: parsed.segment_count ?? parsed.segments?.length ?? 0,
      tileCount: parsed.tile_count ?? 1,
      imageWidth: parsed.image_width ?? 0,
      imageHeight: parsed.image_height ?? 0,
      upscaled: Boolean(parsed.upscaled),
      segments: parsed.segments ?? [],
    };
  } finally {
    await fs.promises.unlink(tmpFile).catch(() => undefined);
  }
}
