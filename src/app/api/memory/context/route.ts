import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/memory/context
 * Get context for an entity (goal, task, strategy)
 *
 * Query params: ?entity=goal_name&type=goal
 * Replaces: POST /api/memory/context
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entity = searchParams.get('entity') || searchParams.get('entityName');
    const type = searchParams.get('type');

    // This would integrate with the search endpoint
    // For now, return empty context (can be enhanced later)

    return NextResponse.json({
      entity,
      type,
      relevantSections: [],
      relatedGoals: [],
      priorStrategies: [],
      recommendations: [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        relevantSections: [],
        relatedGoals: [],
        priorStrategies: [],
        recommendations: [],
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/memory/context
 * Deprecated: Use GET instead
 * Kept for backward compatibility
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entityName, type } = body;

    return NextResponse.json({
      relevantSections: [],
      relatedGoals: [],
      priorStrategies: [],
      recommendations: [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        relevantSections: [],
        relatedGoals: [],
        priorStrategies: [],
        recommendations: [],
      },
      { status: 500 }
    );
  }
}
