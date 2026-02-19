import { homedir } from 'os';
import { promises as fs } from 'fs';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/memory/files
 * Get full memory file content
 *
 * Query param: ?path=memory/notes.md
 * Replaces: POST /api/memory/content
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json(
        { content: '', error: 'Missing path query parameter' },
        { status: 400 }
      );
    }

    const memoryDir = join(homedir(), '.openclaw', 'workspace');
    const fullPath = join(memoryDir, path);

    // Prevent directory traversal
    if (!fullPath.startsWith(memoryDir)) {
      return NextResponse.json({ content: '' }, { status: 403 });
    }

    const content = await fs.readFile(fullPath, 'utf-8');

    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json({ content: '' }, { status: 500 });
  }
}
