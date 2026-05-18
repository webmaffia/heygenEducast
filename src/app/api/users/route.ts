import { NextRequest, NextResponse } from 'next/server';
import { getDb, userQueries, UserRow } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const id = searchParams.get('id');
    const role = searchParams.get('role');

    const db = getDb();

    if (action === 'stats') {
      return NextResponse.json({ data: userQueries.getStats(db) });
    }

    if (id) {
      const user = userQueries.getById(db, id);
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      return NextResponse.json({ data: user });
    }

    if (role) {
      const users = userQueries.getByRole(db, role);
      return NextResponse.json({ data: users });
    }

    const users = userQueries.getAll(db);
    return NextResponse.json({ data: users });
  } catch (error) {
    console.error('Users GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getDb();

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(body.email);
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }

    const user: Omit<UserRow, 'created_at' | 'updated_at'> = {
      id: body.id || `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: body.name || 'New User',
      email: body.email || '',
      role: body.role || 'user',
      status: body.status || 'active',
      avatar: body.avatar || null,
    };

    userQueries.insert(db, user);
    return NextResponse.json({ data: user }, { status: 201 });
  } catch (error) {
    console.error('Users POST error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const db = getDb();
    const existing = userQueries.getById(db, id);
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    userQueries.update(db, id, updates);
    const updated = userQueries.getById(db, id);
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Users PUT error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const db = getDb();
    userQueries.delete(db, id);
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error('Users DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
