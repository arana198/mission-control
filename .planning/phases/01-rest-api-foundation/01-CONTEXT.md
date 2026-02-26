# Phase 1: REST API Foundation & Standardization - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish uniform REST API standards across all 32 existing API routes by migrating to `/api/v1/` with consistent request/response formats, error handling (RFC 9457), pagination (cursor-based), rate limiting, and auto-generated OpenAPI documentation.

This phase is foundation work — no new features are added, only standardization and documentation infrastructure.

</domain>

<decisions>
## Implementation Decisions

### API Versioning Strategy
- **Multiple version support:** Maintain both `/api/v1/` and `/api/v2/` simultaneously (agents can use either)
- **Deprecation timeline:** 6-month window (announce → soft warnings → hard fail)
- **Version in responses:** No version indicators in headers or body; version is implicit from URL path
- **Breaking changes require new version:** Removing/renaming fields, changing endpoint paths/methods, changing error response format
- **Non-breaking additions:** Adding new optional fields does NOT require a version bump

### Pagination & Cursor Design
- **Cursor format:** Base64-encoded offset (transparent: `cursor=base64("offset:100")`)
- **Default and max limits:** Default 20 items, max 100 items per request
- **Cursor expiration:** Cursors expire after 5 minutes of inactivity (prevents stale pagination)
- **Total count:** Always include total count in list responses (`{total: 1000, limit: 20, cursor: "..."}`)

### Rate Limiting & Throttling
- **Bucketing strategy:** Per API Key (fair, prevents one agent from harming others)
- **Algorithm:** Token bucket (allows burst traffic, agents can build up and spend quota)
- **Default quotas:** 1000 requests/hour, 10k requests/day per API key
- **429 guidance:** Include `{retryAfter: 120, resetAt: "2026-02-26T16:45:00Z"}` in response body when limits are hit

### API Documentation Coverage
- **OpenAPI spec scope:** Every endpoint (no hidden APIs; full transparency)
- **Swagger UI interactivity:** Full Try-It-Out mode (humans can test endpoints in browser)
- **Code examples depth:** Minimal (success case + error case per endpoint)
- **Spec generation:** Auto-generated from Zod schemas (zod-openapi; spec always matches code)

### Claude's Discretion
- Exact rate limit values can be adjusted based on agent usage patterns (researcher should validate 1000/hour is reasonable)
- Specific X-RateLimit-* header names and format (standard conventions apply)
- Cursor encoding implementation details (base64 wrapper, hash algorithm for offsets)
- Swagger UI styling and layout

</decisions>

<specifics>
## Specific Ideas

- Keep error responses consistent across all 32 endpoints — RFC 9457 is the standard, no exceptions
- Make cursor pagination "obvious to agents" — they should be able to read base64 and understand pagination state
- Rate limits should feel fair and not punitive; 1000 req/hour gives agents room to batch work
- OpenAPI spec should be the single source of truth for what endpoints exist; no undocumented endpoints

</specifics>

<deferred>
## Deferred Ideas

- **Webhook notifications for API status changes** — belongs in Phase 5 (Activity Logging & Observability)
- **API usage analytics/reporting** — belongs in Phase 5 (metrics and observability)
- **GraphQL support alongside REST** — its own phase in v2 or later
- **API versioning migration tools** — useful but post-v1

</deferred>

---

*Phase: 01-rest-api-foundation*
*Context gathered: 2026-02-26*
