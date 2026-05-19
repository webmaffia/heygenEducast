import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { sizeMbFromBytes } from '@/lib/avatar-video';

const AVATAR_VIDEOS_DIR = path.join(process.cwd(), 'public', 'avatar-videos');

if (!fs.existsSync(AVATAR_VIDEOS_DIR)) {
  fs.mkdirSync(AVATAR_VIDEOS_DIR, { recursive: true });
}

export async function POST(request: NextRequest) {
  try {
    const { url, videoId, fallbackUrl } = await request.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    if (url.startsWith('/avatar-videos/')) {
      return NextResponse.json({ localUrl: url });
    }

    if (isLocalMediaUrl(url)) {
      const pathname = new URL(url).pathname;
      return NextResponse.json({ localUrl: pathname });
    }

    const filename = videoId
      ? `avatar_${videoId}.webm`
      : `avatar_${Date.now()}.webm`;
    const destPath = path.join(AVATAR_VIDEOS_DIR, filename);
    const localUrl = `/avatar-videos/${filename}`;

    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
      const size = fs.statSync(destPath).size;
      return NextResponse.json({ localUrl, sizeMb: sizeMbFromBytes(size), size });
    }

    const deduped = await findDuplicateAvatar(url);
    if (deduped) {
      fs.copyFileSync(deduped, destPath);
      const size = fs.statSync(destPath).size;
      return NextResponse.json({
        localUrl,
        sizeMb: sizeMbFromBytes(size),
        size,
        deduped: true,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600_000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        return NextResponse.json(
          { error: `Download failed: HTTP ${response.status}` },
          { status: 502 },
        );
      }
      if (!response.body) {
        return NextResponse.json(
          { error: 'Download returned empty body' },
          { status: 502 },
        );
      }

      const nodeStream = Readable.fromWeb(
        response.body as Parameters<typeof Readable.fromWeb>[0],
      );
      await pipeline(nodeStream, fs.createWriteStream(destPath));
    } finally {
      clearTimeout(timeout);
    }

    if (!fs.existsSync(destPath) || fs.statSync(destPath).size === 0) {
      return NextResponse.json(
        { error: 'Downloaded file is empty' },
        { status: 502 },
      );
    }

    let size = fs.statSync(destPath).size;
    const maxWebmBytes = 150 * 1024 * 1024;
    if (
      size > maxWebmBytes &&
      typeof fallbackUrl === 'string' &&
      fallbackUrl.startsWith('http')
    ) {
      fs.unlinkSync(destPath);
      await downloadToFile(fallbackUrl, destPath.replace(/\.webm$/, '.mp4'));
      const mp4Path = destPath.replace(/\.webm$/, '.mp4');
      if (fs.existsSync(mp4Path) && fs.statSync(mp4Path).size > 0) {
        const mp4Url = localUrl.replace(/\.webm$/, '.mp4');
        size = fs.statSync(mp4Path).size;
        return NextResponse.json({
          localUrl: mp4Url,
          sizeMb: sizeMbFromBytes(size),
          size,
          format: 'mp4',
        });
      }
    }

    return NextResponse.json({
      localUrl,
      sizeMb: sizeMbFromBytes(size),
      size,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'Avatar download timed out (10 min). Try again or check your network.'
        : error instanceof Error
          ? error.message
          : 'Failed to cache avatar video';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function downloadToFile(url: string, destPath: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 600_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok || !response.body) {
      throw new Error(`Download failed: HTTP ${response.status}`);
    }
    const nodeStream = Readable.fromWeb(
      response.body as Parameters<typeof Readable.fromWeb>[0],
    );
    await pipeline(nodeStream, fs.createWriteStream(destPath));
  } finally {
    clearTimeout(timeout);
  }
}

/** Reuse an existing avatar file when HeyGen returns the same byte length for a new video id. */
async function findDuplicateAvatar(sourceUrl: string): Promise<string | null> {
  if (!fs.existsSync(AVATAR_VIDEOS_DIR)) return null;

  let remoteLength: number | null = null;
  try {
    const headRes = await fetch(sourceUrl, { method: 'HEAD' });
    const len = headRes.headers.get('content-length');
    if (len) remoteLength = Number(len);
  } catch {
    return null;
  }

  if (!remoteLength || remoteLength <= 0) return null;

  const existing = fs
    .readdirSync(AVATAR_VIDEOS_DIR)
    .filter(
      (name) =>
        name.startsWith('avatar_') &&
        (name.endsWith('.webm') || name.endsWith('.mp4')),
    )
    .map((name) => path.join(AVATAR_VIDEOS_DIR, name))
    .filter((p) => fs.statSync(p).size === remoteLength);

  return existing[0] ?? null;
}

function isLocalMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const isLocalHost =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '[::1]';
    return isLocalHost && parsed.pathname.startsWith('/avatar-videos/');
  } catch {
    return false;
  }
}
