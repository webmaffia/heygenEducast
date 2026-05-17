import { NextRequest } from 'next/server';
import { bundle } from '@remotion/bundler';
import { renderMedia, getCompositions } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';
import { Infographic } from '@/remotion/InfographicsOverlay';

const VIDEOS_DIR = path.join(process.cwd(), 'public', 'generated-videos');

if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
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
      const { avatarVideoUrl, backgroundImageUrl, script, durationInFrames, infographics } = body;

      if (!avatarVideoUrl || !backgroundImageUrl || !script) {
        await sendProgress(0, 'Error: Missing required parameters');
        await writer.close();
        return;
      }

      const frames = durationInFrames || 900;
      const infographicsData: Infographic[] = infographics || [];

      const videoId = `video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const outputLocation = path.join(VIDEOS_DIR, `${videoId}.mp4`);

      await sendProgress(5, 'Bundling Remotion project...');
      const bundled = await bundle({
        entryPoint: path.join(process.cwd(), 'src', 'remotion', 'index.ts'),
      });

      await sendProgress(15, 'Loading composition...');
      const compositions = await getCompositions(bundled, {
        inputProps: {
          avatarVideoUrl,
          backgroundImageUrl,
          script,
          durationInFrames: frames,
          infographics: infographicsData,
        },
      });

      const composition = compositions.find((c) => c.id === 'AvatarVideo');
      if (!composition) {
        await sendProgress(0, 'Error: Composition "AvatarVideo" not found');
        await writer.close();
        return;
      }

      await sendProgress(20, `Rendering video: ${frames} frames (${(frames / 30).toFixed(1)}s)...`);
      
      await renderMedia({
        composition: {
          ...composition,
          durationInFrames: frames,
        },
        serveUrl: bundled,
        codec: 'h264',
        outputLocation: outputLocation,
        onProgress: (progress) => {
          const pct = Math.round(20 + progress.progress * 80);
          writer.write(encoder.encode(`data: ${JSON.stringify({ progress: pct, message: `Rendering: ${pct}%` })}\n\n`)).catch(() => {});
        },
      });

      await sendProgress(100, 'Video rendered successfully!');
      await writer.write(encoder.encode(`data: ${JSON.stringify({ progress: 100, done: true, videoUrl: `/generated-videos/${videoId}.mp4`, videoId })}\n\n`));
    } catch (error) {
      await sendProgress(0, `Error: ${error instanceof Error ? error.message : 'Failed to render video'}`);
    } finally {
      await writer.close();
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
