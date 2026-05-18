import { NextRequest, NextResponse } from 'next/server';
import { getDb, subjectQueries } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const subjects = subjectQueries.getAll(db);
    return NextResponse.json({ data: subjects });
  } catch (error) {
    console.error('Subjects GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch subjects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getDb();
    const id = body.id || `subj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    subjectQueries.insert(db, id, body.name);
    const subject = subjectQueries.getById(db, id);
    return NextResponse.json({ data: subject }, { status: 201 });
  } catch (error) {
    console.error('Subjects POST error:', error);
    return NextResponse.json({ error: 'Failed to create subject' }, { status: 500 });
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
    subjectQueries.update(db, id, name);
    const subject = subjectQueries.getById(db, id);
    return NextResponse.json({ data: subject });
  } catch (error) {
    console.error('Subjects PUT error:', error);
    return NextResponse.json({ error: 'Failed to update subject' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Subject ID required' }, { status: 400 });
    }
    const db = getDb();
    subjectQueries.delete(db, id);
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error('Subjects DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete subject' }, { status: 500 });
  }
}
