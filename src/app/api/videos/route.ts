import { NextRequest, NextResponse } from 'next/server';
import { getDb, videoQueries, VideoRow } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const id = searchParams.get('id');
    const status = searchParams.get('status');

    const db = getDb();

    if (action === 'stats') {
      return NextResponse.json({ data: videoQueries.getStats(db) });
    }

    if (id) {
      const video = videoQueries.getById(db, id);
      if (!video) {
        return NextResponse.json({ error: 'Video not found' }, { status: 404 });
      }
      return NextResponse.json({ data: video });
    }

    if (status) {
      const videos = videoQueries.getByStatus(db, status);
      return NextResponse.json({ data: videos });
    }

    const videos = videoQueries.getAll(db);
    return NextResponse.json({ data: videos });
  } catch (error) {
    console.error('Videos GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getDb();

    const video: Omit<VideoRow, 'created_at' | 'updated_at'> = {
      id: body.id || `video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: body.title || 'Untitled Video',
      script: body.script || '',
      background_image: body.backgroundImage || null,
      selected_avatar: body.selectedAvatar || null,
      selected_voice: body.selectedVoice || null,
      avatar_video_url: body.avatarVideoUrl || null,
      rendered_video_url: body.renderedVideoUrl || null,
      video_duration_in_frames: body.videoDurationInFrames || 0,
      infographics: JSON.stringify(body.infographics || []),
      status: body.status || 'draft',
      subject_id: body.subjectId || null,
      chapter_id: body.chapterId || null,
    };

    videoQueries.insert(db, video);
    return NextResponse.json({ data: video }, { status: 201 });
  } catch (error) {
    console.error('Videos POST error:', error);
    return NextResponse.json({ error: 'Failed to create video' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Video ID required' }, { status: 400 });
    }

    const db = getDb();
    const existing = videoQueries.getById(db, id);
    if (!existing) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const formattedUpdates: Partial<VideoRow> = { ...updates };
    if (updates.infographics && typeof updates.infographics !== 'string') {
      formattedUpdates.infographics = JSON.stringify(updates.infographics);
    }
    if (updates.backgroundImage !== undefined) {
      formattedUpdates.background_image = updates.backgroundImage;
    }
    if (updates.selectedAvatar !== undefined) {
      formattedUpdates.selected_avatar = updates.selectedAvatar;
    }
    if (updates.selectedVoice !== undefined) {
      formattedUpdates.selected_voice = updates.selectedVoice;
    }
    if (updates.avatarVideoUrl !== undefined) {
      formattedUpdates.avatar_video_url = updates.avatarVideoUrl;
    }
    if (updates.renderedVideoUrl !== undefined) {
      formattedUpdates.rendered_video_url = updates.renderedVideoUrl;
    }
    if (updates.videoDurationInFrames !== undefined) {
      formattedUpdates.video_duration_in_frames = updates.videoDurationInFrames;
    }
    if (updates.subjectId !== undefined) {
      formattedUpdates.subject_id = updates.subjectId;
    }
    if (updates.chapterId !== undefined) {
      formattedUpdates.chapter_id = updates.chapterId;
    }

    videoQueries.update(db, id, formattedUpdates);
    const updated = videoQueries.getById(db, id);
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Videos PUT error:', error);
    return NextResponse.json({ error: 'Failed to update video' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Video ID required' }, { status: 400 });
    }

    const db = getDb();
    videoQueries.delete(db, id);
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error('Videos DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 });
  }
}
