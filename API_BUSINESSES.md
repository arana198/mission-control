# Businesses API

Create and manage multiple businesses in Mission Control.

## Endpoints

### POST /api/businesses
Create a new business.

**Request:**
```json
{
  "name": "Business Name",
  "slug": "business-slug",
  "emoji": "🏢",
  "color": "blue",
  "description": "Optional description"
}
```

**Required Fields:**
- `name` - Business name (string)
- `slug` - URL-safe slug, must be unique (string, lowercase, no spaces)

**Optional Fields:**
- `emoji` - Business emoji (string)
- `color` - Color theme (string)
- `description` - Business description (string)

**Response (201):**
```json
{
  "success": true,
  "message": "Business \"Acme Corp\" created successfully",
  "businessId": "k8n5m2p0x1q9r4t7"
}
```

**Response (400):**
```json
{
  "success": false,
  "error": "name and slug are required"
}
```

---

### GET /api/businesses
List all businesses.

**Response (200):**
```json
{
  "success": true,
  "businesses": [
    {
      "_id": "k8n5m2p0x1q9r4t7",
      "name": "Mission Control HQ",
      "slug": "mission-control-hq",
      "emoji": "🚀",
      "color": "purple",
      "isDefault": true,
      "createdAt": 1707948900000,
      "updatedAt": 1707948900000
    },
    {
      "_id": "a1b2c3d4e5f6g7h8",
      "name": "Project Alpha",
      "slug": "project-alpha",
      "emoji": "⚙️",
      "color": "blue",
      "isDefault": false,
      "createdAt": 1707948910000,
      "updatedAt": 1707948910000
    }
  ]
}
```

---

## Examples

### Create first business (Mission Control HQ)
```bash
curl -X POST http://localhost:3000/api/businesses \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mission Control HQ",
    "slug": "mission-control-hq",
    "emoji": "🚀",
    "color": "purple",
    "description": "Main headquarters operations"
  }'
```

### Create second business (Project Alpha)
```bash
curl -X POST http://localhost:3000/api/businesses \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Project Alpha",
    "slug": "project-alpha",
    "emoji": "⚙️",
    "color": "blue",
    "description": "Special project operations"
  }'
```

### Create third business (Enterprise Corp)
```bash
curl -X POST http://localhost:3000/api/businesses \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Enterprise Corp",
    "slug": "enterprise-corp",
    "emoji": "🏛️",
    "color": "slate",
    "description": "Enterprise division"
  }'
```

### List all businesses
```bash
curl -X GET http://localhost:3000/api/businesses
```

---

## After Creating Businesses

Once businesses are created via the API:

1. **Access business-specific tabs:**
   - `http://localhost:3000/mission-control-hq/overview`
   - `http://localhost:3000/project-alpha/overview`
   - `http://localhost:3000/enterprise-corp/overview`

2. **Switch businesses in UI:**
   - Click the Business Selector dropdown in the sidebar
   - Select a business to navigate to its dashboard

3. **Access business settings:**
   - `http://localhost:3000/mission-control-hq/settings`
   - Configure GitHub org/repo and ticket prefix per business

4. **Access global features:**
   - `http://localhost:3000/global/activity` - View all activities with business filter
   - `http://localhost:3000/global/workload` - View all workload with business filter
   - `http://localhost:3000/global/calendar` - Shared calendar across all businesses
   - `http://localhost:3000/global/analytics` - Analytics with business filter
   - `http://localhost:3000/settings` - Global settings (dark mode, etc.)

---

## Slug Format

Slugs must:
- Be unique across all businesses
- Use lowercase letters, numbers, hyphens
- Not contain spaces or special characters
- Be URL-safe

**Valid examples:**
- `mission-control-hq`
- `project-alpha`
- `acme-corp-2024`
- `team-beta`

**Invalid examples:**
- `Mission Control HQ` (spaces, uppercase)
- `project_alpha` (underscore)
- `project@corp` (special character)

---

## Color Themes

Recommended colors:
- `purple` - Primary
- `blue` - Secondary
- `slate` - Neutral
- `emerald` - Green
- `amber` - Orange
- `rose` - Red

---

## Setup Script

Create businesses via Node.js script:

```javascript
// scripts/create-businesses.js
const businesses = [
  {
    name: "Mission Control HQ",
    slug: "mission-control-hq",
    emoji: "🚀",
    color: "purple",
    description: "Main headquarters"
  },
  {
    name: "Project Alpha",
    slug: "project-alpha",
    emoji: "⚙️",
    color: "blue",
    description: "Project operations"
  },
  {
    name: "Enterprise Corp",
    slug: "enterprise-corp",
    emoji: "🏛️",
    color: "slate",
    description: "Enterprise division"
  }
];

async function createBusinesses() {
  for (const business of businesses) {
    const res = await fetch("http://localhost:3000/api/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(business)
    });
    const data = await res.json();
    console.log(`✓ Created: ${business.name} (${business.slug})`);
  }
}

createBusinesses();
```

Run with: `node scripts/create-businesses.js`
