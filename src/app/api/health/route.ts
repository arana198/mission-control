/**
 * Health Check Endpoint
 * GET /api/health
 *
 * Returns system health status for monitoring and uptime checks
 */

export async function GET() {
  try {
    const timestamp = Date.now();
    const uptime = process.uptime();

    return Response.json({
      status: "healthy",
      timestamp,
      uptime,
      environment: process.env.NODE_ENV || "unknown",
      version: process.env.npm_package_version || "unknown",
    });
  } catch (error) {
    return Response.json(
      {
        status: "unhealthy",
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
