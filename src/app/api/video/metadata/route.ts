import { NextRequest, NextResponse } from 'next/server';

import fs from 'fs';

import path from 'path';

import { sizeMbFromBytes } from '@/lib/avatar-video';

import {

  getAvatarDurationFromUrl,

  getAvatarDurationInFrames,

} from '@/lib/get-avatar-duration';



const AVATAR_VIDEOS_DIR = path.join(process.cwd(), 'public', 'avatar-videos');



export async function GET(request: NextRequest) {

  const url = new URL(request.url).searchParams.get('url');

  if (!url) {

    return NextResponse.json({ error: 'url is required' }, { status: 400 });

  }



  if (url.startsWith('http://') || url.startsWith('https://')) {

    const durationInFrames = (await getAvatarDurationFromUrl(url)) ?? 900;
    let sizeMb: number | undefined;
    try {
      const headRes = await fetch(url, { method: 'HEAD' });
      const len = headRes.headers.get('content-length');
      if (len) sizeMb = sizeMbFromBytes(Number(len));
    } catch { /* optional */ }

    return NextResponse.json({ durationInFrames, remote: true, sizeMb });

  }



  if (!url.startsWith('/avatar-videos/')) {

    return NextResponse.json(

      { error: 'url must be a remote http(s) URL or /avatar-videos/ path' },

      { status: 400 },

    );

  }



  const filename = path.basename(url);

  if (filename.includes('..')) {

    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });

  }



  const fullPath = path.join(AVATAR_VIDEOS_DIR, filename);

  if (!fs.existsSync(fullPath)) {

    return NextResponse.json({ error: 'File not found' }, { status: 404 });

  }



  const stat = fs.statSync(fullPath);

  const sizeMb = sizeMbFromBytes(stat.size);

  const durationInFrames = (await getAvatarDurationInFrames(fullPath)) ?? 900;



  return NextResponse.json({ durationInFrames, sizeMb, size: stat.size });

}

