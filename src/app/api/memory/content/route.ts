import { homedir } from 'os';
import { promises as fs } from 'fs';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/memory/content
 * Get full memory file content
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path } = body;

    if (!path) {
      return NextResponse.json({ content: '' }, { status: 400 });
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
    // Error logged in system: 'Memory read error:', error);
    return NextResponse.json({ content: '' }, { status: 500 });
  }
}
