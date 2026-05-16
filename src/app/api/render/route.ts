import { NextRequest, NextResponse } from 'next/server';
import { bundle } from '@remotion/bundler';
import { renderMedia, getCompositions } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';

const VIDEOS_DIR = path.join(process.cwd(), 'public', 'generated-videos');

if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { avatarVideoUrl, backgroundImageUrl, script, durationInFrames } = body;

    if (!avatarVideoUrl || !backgroundImageUrl || !script) {
      return NextResponse.json(
        { error: 'avatarVideoUrl, backgroundImageUrl, and script are required' },
        { status: 400 }
      );
    }

    const frames = durationInFrames || 900;
    const videoId = `video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const outputLocation = path.join(VIDEOS_DIR, `${videoId}.mp4`);

    console.log('Bundling Remotion project...');
    const bundled = await bundle({
      entryPoint: path.join(process.cwd(), 'src', 'remotion', 'index.ts'),
    });

    console.log('Getting compositions...');
    const compositions = await getCompositions(bundled, {
      inputProps: {
        avatarVideoUrl,
        backgroundImageUrl,
        script,
      },
    });

    const composition = compositions.find((c) => c.id === 'AvatarVideo');
    if (!composition) {
      throw new Error('Composition "AvatarVideo" not found');
    }

    console.log(`Rendering video: ${frames} frames (${(frames / 30).toFixed(1)}s)...`);
    await renderMedia({
      composition: {
        ...composition,
        durationInFrames: frames,
      },
      serveUrl: bundled,
      codec: 'h264',
      outputLocation: outputLocation,
      onProgress: (progress) => {
        console.log(`Rendering: ${Math.round(progress.progress * 100)}%`);
      },
    });

    return NextResponse.json({
      videoUrl: `/generated-videos/${videoId}.mp4`,
      videoId,
    });
  } catch (error) {
    console.error('Video rendering error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to render video' },
      { status: 500 }
    );
  }
}
