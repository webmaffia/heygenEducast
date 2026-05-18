import { NextRequest, NextResponse } from 'next/server';
import { getDb, chapterQueries } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const subjectId = searchParams.get('subjectId');
    const id = searchParams.get('id');
    const db = getDb();

    if (id) {
      const chapter = chapterQueries.getById(db, id);
      if (!chapter) {
        return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
      }
      return NextResponse.json({ data: chapter });
    }

    if (subjectId) {
      const chapters = chapterQueries.getBySubject(db, subjectId);
      return NextResponse.json({ data: chapters });
    }

    const chapters = chapterQueries.getAll(db);
    return NextResponse.json({ data: chapters });
  } catch (error) {
    console.error('Chapters GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch chapters' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getDb();
    const id = body.id || `ch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    chapterQueries.insert(db, id, body.subjectId, body.name);
    const chapter = chapterQueries.getById(db, id);
    return NextResponse.json({ data: chapter }, { status: 201 });
  } catch (error) {
    console.error('Chapters POST error:', error);
    return NextResponse.json({ error: 'Failed to create chapter' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name } = body;
    if (!id || !name) {
      return NextResponse.json({ error: 'ID and name required' }, { status: 400 });
    }
    const db = getDb();
    chapterQueries.update(db, id, name);
    const chapter = chapterQueries.getById(db, id);
    return NextResponse.json({ data: chapter });
  } catch (error) {
    console.error('Chapters PUT error:', error);
    return NextResponse.json({ error: 'Failed to update chapter' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Chapter ID required' }, { status: 400 });
    }
    const db = getDb();
    chapterQueries.delete(db, id);
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error('Chapters DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete chapter' }, { status: 500 });
  }
}
