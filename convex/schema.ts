import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // ============================================================
  // SOURCES & CRAWLER CONFIGURATION
  // ============================================================

  sources: defineTable({
    url: v.string(),
    name: v.optional(v.string()),
    entityType: v.optional(v.string()), // "commune|association|venue|..."
    govdirectory: v.optional(v.string()),
    canton: v.optional(v.string()), // "ZH", "VD", ...
    commune: v.optional(v.string()), // "Zürich", "Lausanne", ...
    lang: v.optional(v.string()), // primary: "de|fr|it|rm|en"
    profileId: v.optional(v.id('profiles')), // link to crawler config
    enabled: v.boolean(),
    hash: v.string(), // dedupe key (url hash)
    lastFetchAt: v.optional(v.number()),
    etag: v.optional(v.string()),
    lastModified: v.optional(v.string()),
    notes: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_enabled', ['enabled'])
    .index('by_url', ['url'])
    .index('by_canton', ['canton'])
    .index('by_hash', ['hash']),

  // Per-site crawler configuration (YAML-style, stored as JSON)
  profiles: defineTable({
    siteId: v.string(), // e.g., "gemeinde-zug"
    domain: v.string(),
    lang: v.string(),
    timezone: v.string(), // "Europe/Zurich"
    config: v.any(), // full YAML-like object: start_urls, item selectors, pagination, detail_page, etc.
    version: v.number(),
    enabled: v.boolean(),
    notes: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_site', ['siteId'])
    .index('by_enabled', ['enabled']),

  // ============================================================
  // INGESTION PIPELINE
  // ============================================================

  // Raw documents (HTML/PDF) stored in R2
  docs: defineTable({
    sourceId: v.id('sources'),
    r2Key: v.string(), // path in R2 bucket
    sha256: v.string(),
    mime: v.string(),
    sizeBytes: v.optional(v.number()),
    fetchedAt: v.number(),
    status: v.string(), // "new|parsed|extracted|error"
    error: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_source', ['sourceId'])
    .index('by_status', ['status'])
    .index('by_sha256', ['sha256']),

  // Parsed text blocks (OCR/HTML extraction) stored in R2
  parsed: defineTable({
    docId: v.id('docs'),
    r2Key: v.string(), // parsed JSONL in R2
    lang: v.string(),
    blockCount: v.number(),
    ocrUsed: v.boolean(),
    parsedAt: v.number(),
    status: v.string(), // "new|extracted|error"
    error: v.optional(v.string()),
  })
    .index('by_doc', ['docId'])
    .index('by_status', ['status']),

  // Queue for detail page fetches (list → detail)
  details_queue: defineTable({
    sourceId: v.id('sources'),
    url: v.string(),
    urlHash: v.string(), // dedupe
    meta: v.optional(v.any()), // snippet from list (title, date_block, ...)
    status: v.string(), // "pending|fetched|error"
    attempts: v.number(),
    lastAttempt: v.optional(v.number()),
    error: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_status', ['status'])
    .index('by_hash', ['urlHash']),

  // ============================================================
  // EVENTS (language-neutral facts)
  // ============================================================

  events: defineTable({
    sourceUrl: v.string(),
    // Time
    start: v.number(), // epoch ms
    end: v.optional(v.number()),
    allDay: v.boolean(),
    tz: v.string(), // "Europe/Zurich"
    recurrence: v.optional(v.string()), // RRULE or short code

    // Place
    cityId: v.optional(v.string()), // link to places or BFS id
    venueId: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    geohash5: v.optional(v.string()), // for regional buckets
    geohash7: v.optional(v.string()), // for radius prefilter

    // Classification
    category: v.optional(v.string()), // "kids|sport|culture|market|music|edu|other"
    ageMin: v.optional(v.number()),
    ageMax: v.optional(v.number()),
    priceType: v.optional(v.string()), // "free|paid|donation|unknown"
    priceAmount: v.optional(v.string()), // e.g., "CHF 5–10"

    // Media
    images: v.optional(v.array(v.string())),
    attachments: v.optional(v.array(v.string())),

    // Provenance & Quality
    sourceLanguage: v.string(), // "de|fr|it|rm|en"
    sourceKind: v.string(), // "pdf|html|ics|api|manual"
    contentHash: v.string(), // for dedupe
    confidence: v.optional(v.number()), // 0..1
    verified: v.boolean(), // passed validation
    cancelled: v.boolean(),

    updatedAt: v.number(),
  })
    .index('by_hash', ['contentHash'])
    .index('by_start', ['start'])
    .index('by_geo7_start', ['geohash7', 'start'])
    .index('by_city_start', ['cityId', 'start'])
    .index('by_verified', ['verified'])
    .index('by_category', ['category']),

  // Localized text per event
  event_i18n: defineTable({
    eventId: v.id('events'),
    locale: v.string(), // "de|fr|it|rm|en"
    title: v.string(),
    subtitle: v.optional(v.string()),
    description: v.optional(v.string()),
    venueDisplayName: v.optional(v.string()),
    priceDisplay: v.optional(v.string()),
    organizerName: v.optional(v.string()),
    origin: v.string(), // "source|machine|human"
    quality: v.optional(v.number()), // 0..1
    provenance: v.optional(v.string()), // source URL/doc id
    updatedAt: v.number(),
  })
    .index('by_event_locale', ['eventId', 'locale'])
    .index('by_locale', ['locale'])
    .index('by_origin', ['origin']),

  // ============================================================
  // PLACES (optional: normalized cities/venues)
  // ============================================================

  places: defineTable({
    kind: v.string(), // "city|venue"
    externalId: v.optional(v.string()), // BFS id, etc.
    lat: v.number(),
    lng: v.number(),
    geohash5: v.string(),
    geohash7: v.string(),
  })
    .index('by_kind', ['kind'])
    .index('by_external', ['externalId']),

  place_i18n: defineTable({
    placeId: v.id('places'),
    locale: v.string(),
    name: v.string(),
    slug: v.optional(v.string()),
  }).index('by_place_locale', ['placeId', 'locale']),

  // ============================================================
  // USERS & ALERTS
  // ============================================================

  users: defineTable({
    authId: v.string(), // provider id (Clerk, Auth0, etc.)
    email: v.string(),
    name: v.optional(v.string()),
    // Home location
    homeLat: v.optional(v.number()),
    homeLng: v.optional(v.number()),
    homeGeohash5: v.optional(v.string()),
    homeCityId: v.optional(v.string()),
    // Preferences
    kidsAges: v.optional(v.array(v.number())),
    preferredLocale: v.optional(v.string()), // "de|fr|it|en"
    prefs: v.optional(v.any()),
    // Mobile
    expoPushToken: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_auth', ['authId'])
    .index('by_email', ['email']),

  alerts: defineTable({
    userId: v.id('users'),
    radiusKm: v.number(), // 20|30|40
    categories: v.array(v.string()),
    age: v.optional(v.number()), // filter events for this age
    daysAhead: v.number(), // e.g., 14 (look 2 weeks ahead)
    cadence: v.string(), // "hourly|daily|weekly"
    enabled: v.boolean(),
    lastSentAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_enabled', ['enabled']),

  // ============================================================
  // WORKFLOWS & OBSERVABILITY
  // ============================================================

  runs: defineTable({
    kind: v.string(), // "crawl|parse|extract|notify|repair"
    ref: v.optional(v.string()), // source/doc/profile id
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    ok: v.optional(v.boolean()),
    meta: v.optional(v.any()), // counts, errors, etc.
    error: v.optional(v.string()),
  })
    .index('by_kind', ['kind'])
    .index('by_time', ['startedAt'])
    .index('by_ref', ['ref']),

  // Optional: human review queue for low-confidence events
  reviews: defineTable({
    eventId: v.id('events'),
    reason: v.string(), // "low_confidence|date_mismatch|missing_location|..."
    status: v.string(), // "pending|approved|rejected|fixed"
    assignedTo: v.optional(v.id('users')),
    notes: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
  })
    .index('by_status', ['status'])
    .index('by_event', ['eventId']),
});
