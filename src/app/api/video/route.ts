import { NextRequest, NextResponse } from 'next/server';
import { createVideo, getVideoStatus, listAvatars, listVoices } from '@/lib/heygen';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const videoId = searchParams.get('videoId');

  try {
    if (action === 'avatars') {
      const data = await listAvatars();
      return NextResponse.json(data);
    }

    if (action === 'voices') {
      const data = await listVoices();
      return NextResponse.json(data);
    }

    if (action === 'status' && videoId) {
      const data = await getVideoStatus(videoId);
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { avatar_id, voice_id, input_text, title } = body;

    if (!avatar_id || !voice_id || !input_text) {
      return NextResponse.json(
        { error: 'avatar_id, voice_id, and input_text are required' },
        { status: 400 }
      );
    }

    const data = await createVideo({ avatar_id, voice_id, input_text, title });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
