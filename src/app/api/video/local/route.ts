import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const AVATAR_VIDEOS_DIR = path.join(process.cwd(), 'public', 'avatar-videos');

export async function GET() {
  if (!fs.existsSync(AVATAR_VIDEOS_DIR)) {
    return NextResponse.json({ videos: [], latest: null });
  }

  const videos = fs
    .readdirSync(AVATAR_VIDEOS_DIR)
    .filter(
      (name) =>
        name.startsWith('avatar_') &&
        (name.endsWith('.webm') || name.endsWith('.mp4')),
    )
    .map((name) => {
      const fullPath = path.join(AVATAR_VIDEOS_DIR, name);
      const stat = fs.statSync(fullPath);
      return {
        name,
        url: `/avatar-videos/${name}`,
        size: stat.size,
        sizeMb: Math.round((stat.size / (1024 * 1024)) * 10) / 10,
        updatedAt: stat.mtime.toISOString(),
      };
    })
    .filter((v) => v.size > 0)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return NextResponse.json({
    videos,
    latest: videos[0]?.url ?? null,
  });
}
