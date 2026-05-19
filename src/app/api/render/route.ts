import { NextRequest } from 'next/server';
import { bundle } from '@remotion/bundler';
import { renderMedia, getCompositions } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { Infographic } from '@/remotion/InfographicsOverlay';
import {
  getAvatarDurationFromUrl,
  getAvatarDurationInFrames,
} from '@/lib/get-avatar-duration';

const VIDEOS_DIR = path.join(process.cwd(), 'public', 'generated-videos');
const AVATAR_VIDEOS_DIR = path.join(process.cwd(), 'public', 'avatar-videos');

if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}
if (!fs.existsSync(AVATAR_VIDEOS_DIR)) {
  fs.mkdirSync(AVATAR_VIDEOS_DIR, { recursive: true });
}

function resolvePublicPath(url: string): string {
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('file://')
  ) {
    return url;
  }
  if (url.startsWith('/')) {
    return path.join(process.cwd(), 'public', url.slice(1));
  }
  return url;
}

/** Remotion's renderer downloads assets over HTTP — map public/ files to the running Next server. */
function toPublicUrl(filePath: string, baseUrl: string): string {
  if (
    filePath.startsWith('http://') ||
    filePath.startsWith('https://') ||
    filePath.startsWith('data:')
  ) {
    return filePath;
  }
  const publicDir = path.join(process.cwd(), 'public');
  const relative = path.relative(publicDir, path.resolve(filePath)).replace(/\\/g, '/');
  return `${baseUrl}/${relative}`;
}

function getRenderBaseUrl(request: NextRequest): string {
  const { hostname, port } = request.nextUrl;
  const host = hostname === 'localhost' ? '127.0.0.1' : hostname;
  const portSuffix =
    port && !['80', '443'].includes(port) ? `:${port}` : '';
  return `${request.nextUrl.protocol}//${host}${portSuffix}`;
}

function extensionFromDataUrl(dataUrl: string): string {
  const mime = dataUrl.match(/^data:([^;,]+)/)?.[1] ?? 'image/png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('png')) return 'png';
  return 'png';
}

function saveDataUrlToFile(dataUrl: string, destDir: string, prefix: string): string {
  const base64Data = dataUrl.split(',')[1];
  if (!base64Data) {
    throw new Error('Invalid image data URL');
  }
  const ext = extensionFromDataUrl(dataUrl);
  const destPath = path.join(destDir, `${prefix}_${Date.now()}.${ext}`);
  fs.writeFileSync(destPath, Buffer.from(base64Data, 'base64'));
  return destPath;
}

function isLocalMediaUrl(url: string): boolean {
  if (url.startsWith('/avatar-videos/')) return true;
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

async function prepareImageAsset(
  imageUrl: string,
  baseUrl: string,
  prefix: string,
): Promise<string> {
  if (imageUrl.startsWith('blob:')) {
    throw new Error(
      'Image uses a temporary browser URL. Re-upload the image before rendering.',
    );
  }

  if (imageUrl.startsWith('data:')) {
    const filePath = saveDataUrlToFile(imageUrl, AVATAR_VIDEOS_DIR, prefix);
    return toPublicUrl(filePath, baseUrl);
  }

  if (isLocalMediaUrl(imageUrl)) {
    const pathname = imageUrl.startsWith('/')
      ? imageUrl
      : new URL(imageUrl).pathname;
    const localPath = resolvePublicPath(pathname);
    if (!fs.existsSync(localPath)) {
      throw new Error(`Image not found on disk: ${pathname}`);
    }
    return toPublicUrl(localPath, baseUrl);
  }

  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(imageUrl, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Failed to download image: HTTP ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') ?? '';
      const ext = contentType.includes('jpeg')
        ? 'jpg'
        : contentType.includes('webp')
          ? 'webp'
          : contentType.includes('gif')
            ? 'gif'
            : 'png';
      const filePath = path.join(
        AVATAR_VIDEOS_DIR,
        `${prefix}_${Date.now()}.${ext}`,
      );
      fs.writeFileSync(filePath, buffer);
      return toPublicUrl(filePath, baseUrl);
    } finally {
      clearTimeout(timeout);
    }
  }

  const localPath = resolvePublicPath(imageUrl);
  if (!fs.existsSync(localPath)) {
    throw new Error(`Image not found: ${imageUrl}`);
  }
  return toPublicUrl(localPath, baseUrl);
}

async function prepareInfographics(
  items: Infographic[],
  baseUrl: string,
): Promise<Infographic[]> {
  return Promise.all(
    items.map(async (item, index) => ({
      ...item,
      imageUrl: await prepareImageAsset(item.imageUrl, baseUrl, `info_${index}`),
    })),
  );
}

function getCachedAvatarPath(videoId?: string): string | null {
  if (videoId) {
    for (const ext of ['.webm', '.mp4']) {
      const byId = path.join(AVATAR_VIDEOS_DIR, `avatar_${videoId}${ext}`);
      if (fs.existsSync(byId) && fs.statSync(byId).size > 0) {
        return byId;
      }
    }
  }

  if (!fs.existsSync(AVATAR_VIDEOS_DIR)) return null;

  const candidates = fs
    .readdirSync(AVATAR_VIDEOS_DIR)
    .filter(
      (name) =>
        name.startsWith('avatar_') &&
        (name.endsWith('.webm') || name.endsWith('.mp4')),
    )
    .map((name) => {
      const fullPath = path.join(AVATAR_VIDEOS_DIR, name);
      return { fullPath, mtime: fs.statSync(fullPath).mtimeMs };
    })
    .filter((entry) => fs.statSync(entry.fullPath).size > 0)
    .sort((a, b) => b.mtime - a.mtime);

  return candidates[0]?.fullPath ?? null;
}

async function downloadRemoteVideo(
  url: string,
  destPath: string,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 600_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to download avatar video: HTTP ${response.status}`);
    }
    if (!response.body) {
      throw new Error('Avatar video download returned empty body');
    }

    const nodeStream = Readable.fromWeb(
      response.body as Parameters<typeof Readable.fromWeb>[0],
    );
    await pipeline(nodeStream, fs.createWriteStream(destPath));
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        'Avatar download timed out after 10 minutes. Wait for avatar generation to finish caching, then try again.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function prepareAvatarVideo(
  avatarVideoUrl: string,
  baseUrl: string,
  videoId: string | undefined,
  onProgress: (pct: number, message: string) => Promise<void>,
): Promise<string> {
  if (avatarVideoUrl.startsWith('/avatar-videos/')) {
    const localPath = resolvePublicPath(avatarVideoUrl);
    if (!fs.existsSync(localPath)) {
      throw new Error(`Avatar video not found on disk: ${avatarVideoUrl}`);
    }
    return toPublicUrl(localPath, baseUrl);
  }

  if (isLocalMediaUrl(avatarVideoUrl)) {
    const pathname = new URL(avatarVideoUrl).pathname;
    const localPath = resolvePublicPath(pathname);
    if (!fs.existsSync(localPath)) {
      throw new Error(`Avatar video not found on disk: ${pathname}`);
    }
    return toPublicUrl(localPath, baseUrl);
  }

  if (
    avatarVideoUrl.startsWith('http://') ||
    avatarVideoUrl.startsWith('https://')
  ) {
    await onProgress(8, 'Using remote avatar video from HeyGen...');
    return avatarVideoUrl;
  }

  const localPath = resolvePublicPath(avatarVideoUrl);
  if (!fs.existsSync(localPath)) {
    throw new Error(`Avatar video not found: ${avatarVideoUrl}`);
  }
  return toPublicUrl(localPath, baseUrl);
}

function resolveAvatarDiskPath(
  avatarVideoUrl: string,
  videoId?: string,
): string | null {
  if (avatarVideoUrl.startsWith('/avatar-videos/')) {
    const localPath = resolvePublicPath(avatarVideoUrl);
    return fs.existsSync(localPath) ? localPath : null;
  }
  if (isLocalMediaUrl(avatarVideoUrl)) {
    const pathname = new URL(avatarVideoUrl).pathname;
    const localPath = resolvePublicPath(pathname);
    return fs.existsSync(localPath) ? localPath : null;
  }
  const cached = getCachedAvatarPath(videoId);
  return cached && fs.existsSync(cached) ? cached : null;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendProgress = async (progress: number, message: string) => {
    const data = `data: ${JSON.stringify({ progress, message })}\n\n`;
    await writer.write(encoder.encode(data));
  };

  (async () => {
    try {
      const body = await request.json();
      const {
        avatarVideoUrl,
        backgroundImageUrl,
        script,
        durationInFrames,
        infographics,
        scriptFontSize = 28,
        videoTransparency = 65,
        videoId: heygenVideoId,
      } = body;

      if (!avatarVideoUrl || !backgroundImageUrl || !script) {
        await sendProgress(0, 'Error: Missing required parameters');
        await writer.close();
        return;
      }

      let frames = durationInFrames || 900;
      const infographicsData: Infographic[] = infographics || [];
      const fontSize = scriptFontSize || 28;

      const videoId = `video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const outputLocation = path.join(VIDEOS_DIR, `${videoId}.mp4`);
      const baseUrl = getRenderBaseUrl(request);

      await sendProgress(5, 'Preparing media files...');

      if (
        avatarVideoUrl.startsWith('http://') ||
        avatarVideoUrl.startsWith('https://')
      ) {
        const probedFrames = await getAvatarDurationFromUrl(avatarVideoUrl);
        if (probedFrames) frames = probedFrames;
      } else {
        const avatarDiskPath = resolveAvatarDiskPath(avatarVideoUrl, heygenVideoId);
        if (avatarDiskPath) {
          const probedFrames = await getAvatarDurationInFrames(avatarDiskPath);
          if (probedFrames) frames = probedFrames;
        }
      }

      const localAvatarVideoUrl = await prepareAvatarVideo(
        avatarVideoUrl,
        baseUrl,
        heygenVideoId,
        sendProgress,
      );
      await sendProgress(9, 'Saving background image...');
      const localBackgroundImageUrl = await prepareImageAsset(
        backgroundImageUrl,
        baseUrl,
        'bg',
      );
      const preparedInfographics = await prepareInfographics(
        infographicsData,
        baseUrl,
      );

      const inputProps = {
        avatarVideoUrl: localAvatarVideoUrl,
        backgroundImageUrl: localBackgroundImageUrl,
        script,
        durationInFrames: frames,
        infographics: preparedInfographics,
        scriptFontSize: fontSize,
        videoTransparency,
      };

      await sendProgress(10, 'Bundling Remotion project (first run may take 1–2 min)...');
      const bundled = await bundle({
        entryPoint: path.join(process.cwd(), 'src', 'remotion', 'index.ts'),
      });

      await sendProgress(15, 'Loading composition...');
      const compositions = await getCompositions(bundled, { inputProps });

      const composition = compositions.find((c) => c.id === 'AvatarVideo');
      if (!composition) {
        throw new Error('Composition "AvatarVideo" not found');
      }

      await sendProgress(
        20,
        `Rendering video: ${frames} frames (${(frames / 30).toFixed(1)}s)...`,
      );

      await renderMedia({
        composition: {
          ...composition,
          durationInFrames: frames,
        },
        serveUrl: bundled,
        codec: 'h264',
        outputLocation,
        inputProps,
        onProgress: ({ progress }) => {
          const pct = Math.round(20 + progress * 80);
          writer
            .write(
              encoder.encode(
                `data: ${JSON.stringify({ progress: pct, message: `Rendering: ${pct}%` })}\n\n`,
              ),
            )
            .catch(() => {});
        },
      });

      await sendProgress(100, 'Video rendered successfully!');
      await writer.write(
        encoder.encode(
          `data: ${JSON.stringify({
            progress: 100,
            done: true,
            videoUrl: `/generated-videos/${videoId}.mp4`,
            videoId,
          })}\n\n`,
        ),
      );
      await writer.close();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to render video';
      console.error('Render error:', error);
      try {
        await sendProgress(0, `Error: ${message}`);
        await writer.close();
      } catch {
        // stream already closed
      }
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
