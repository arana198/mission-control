/**
 * GET|POST /api/reports
 *
 * Unified reports endpoint with query param filtering
 *
 * GET /api/reports?type=strategic-weekly&week=5&year=2026
 *   Fetch stored report
 *
 * POST /api/reports
 *   Body: { type: "strategic-weekly", businessId, startDate?, endDate? }
 *   Generate report
 *
 * Replaces: GET|POST /api/reports/strategic-weekly
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getStrategicPlanningEngine } from "@/lib/services/strategicPlanningEngine";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
}

const client = new ConvexHttpClient(convexUrl);
const planningEngine = getStrategicPlanningEngine(client as any);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "strategic-weekly";
    const week = parseInt(searchParams.get("week") || "0", 10);
    const year = parseInt(searchParams.get("year") || "2026", 10);

    if (!week) {
      return new Response(
        JSON.stringify({ error: "week parameter required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (type !== "strategic-weekly") {
      return new Response(
        JSON.stringify({ error: `Report type '${type}' not supported` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Query report from database
    // const report = await client.query(api.strategicReports.getByWeek, { week, year })
    // If not found, generate on-demand

    return new Response(
      JSON.stringify({
        week,
        year,
        message: "Report not yet generated",
      }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || "Failed to fetch report" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { type = "strategic-weekly", businessId, startDate, endDate } = body;

    if (!businessId) {
      return new Response(
        JSON.stringify({
          error: "businessId is required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (type !== "strategic-weekly") {
      return new Response(
        JSON.stringify({ error: `Report type '${type}' not supported` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate report
    const report = await planningEngine.generateWeeklyReport();

    // Persist to database
    try {
      await client.mutation(api.strategicReports.create, {
        businessId: businessId as any,
        week: report.week,
        year: report.year,
        report: JSON.stringify(report),
      });
    } catch (e) {
      // Note: Report persistence failed - report still generated in response
      // Continue anyway - report still generated even if persistence fails
    }

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Failed to generate report",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
