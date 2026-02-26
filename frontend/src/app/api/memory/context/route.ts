import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/memory/context
 * Get context for an entity (goal, task, strategy)
 *
 * Query params: ?entity=goal_name&type=goal
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
