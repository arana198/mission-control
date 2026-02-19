/**
 * GET /api/openapi
 *
 * Returns the OpenAPI 3.0 specification for all Mission Control APIs
 * Used by Swagger UI and other API documentation tools
 */

import { generateOpenAPISpec } from "@/lib/openapi-generator";

export async function GET(): Promise<Response> {
  try {
    const spec = generateOpenAPISpec();

    return new Response(JSON.stringify(spec), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error generating OpenAPI spec:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to generate OpenAPI specification",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
