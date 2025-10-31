import { defineSchema, defineTable } from 'convex/server';

import { v } from 'convex/values';

export default defineSchema({
  /**
   * SOURCES: municipal/organization websites you crawl.
   * Seeded from your TSV/CSV. Used by crawl workflows.
   */
  sources: defineTable({
    url: v.string(),
    name: v.optional(v.string()),
    entityType: v.optional(v.string()), // e.g. "commune|association|dept|venue"
    govdirectory: v.optional(v.string()),
    canton: v.optional(v.string()), // "ZH", "VD", ... (optional at start)
    commune: v.optional(v.string()),
    lang: v.optional(v.string()), // primary site language if known ("de|fr|it|en")
    crawlerKind: v.string(), // "auto" | "html" | "pdf" | "api"
    enabled: v.boolean(),
    hash: v.string(), // dedupe key for imports
    lastFetchAt: v.optional(v.number()),
    etag: v.optional(v.string()),
    lastModified: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index('by_enabled', ['enabled'])
    .index('by_url', ['url']),

  /**
   * PROFILES: per-site extraction config (selectors, pagination, date formats, etc.).
   * Store as JSON; version when updated.
   */
  profiles: defineTable({
    sourceId: v.id('sources'),
    version: v.number(),
    active: v.boolean(),
    kind: v.string(), // "config|plugin"
    config: v.any(), // JSON/YAML parsed object with selectors, patterns
    updatedAt: v.number(),
  })
    .index('by_source', ['sourceId'])
    .index('by_active', ['active']),

  /**
   * DOCS: raw files/pages fetched and stored in R2 (optional for MVP but helpful for provenance).
   */
  docs: defineTable({
    sourceId: v.id('sources'),
    r2Key: v.string(), // raw/{...}
    sha256: v.string(),
    mime: v.string(), // text/html, application/pdf, text/calendar, ...
    fetchedAt: v.number(),
    status: v.string(), // "new|parsed|extracted|error"
    error: v.optional(v.string()),
  })
    .index('by_source', ['sourceId'])
    .index('by_status', ['status']),

  /**
   * PARSED: normalized text blocks produced from DOCS (PDF→text, HTML→text, etc.).
   */
  parsed: defineTable({
    docId: v.id('docs'),
    parsedKey: v.string(), // parsed/{...}.jsonl in R2
    lang: v.optional(v.string()),
    blockCount: v.number(),
    ocrUsed: v.boolean(),
    parsedAt: v.number(),
  }).index('by_doc', ['docId']),

  /**
   * DETAILS QUEUE: list→detail crawl tasks when rich data lives behind a click.
   */
  details_queue: defineTable({
    sourceId: v.id('sources'),
    url: v.string(),
    status: v.string(), // "pending|ok|error"
    attempts: v.number(),
    lastError: v.optional(v.string()),
    queuedAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_source', ['sourceId'])
    .index('by_status', ['status']),

  /**
   * EVENTS: language-neutral facts. One row per event occurrence (after dedupe).
   */
  events: defineTable({
    sourceUrl: v.string(), // canonical page
    start: v.number(), // epoch ms (Europe/Zurich)
    end: v.optional(v.number()),
    allDay: v.boolean(),
    tz: v.string(), // "Europe/Zurich"

    // Location facts
    locationName: v.optional(v.string()),
    street: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    city: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    geohash5: v.optional(v.string()), // regional bucket
    geohash7: v.optional(v.string()), // radius prefilter

    // Classification
    category: v.optional(v.string()), // "kids|sport|culture|market|music|edu|other"
    ageMin: v.optional(v.number()),
    ageMax: v.optional(v.number()),
    priceType: v.optional(v.string()), // "free|paid|donation"
    recurrence: v.optional(v.string()), // RRULE or short code

    images: v.optional(v.array(v.string())),

    // Provenance & quality
    sourceLanguage: v.optional(v.string()), // "de|fr|it|en"
    contentHash: v.string(), // hash(normalizedTitle + start + city)
    verified: v.boolean(),
    confidence: v.optional(v.number()), // 0..1

    updatedAt: v.number(),
    cancelled: v.boolean(),
  })
    .index('by_hash', ['contentHash'])
    .index('by_start', ['start'])
    .index('by_geo7', ['geohash7'])
    .index('by_city_start', ['city', 'start']),

  /**
   * EVENT_I18N: localized text per event and locale. Facts stay in `events`.
   */
  event_i18n: defineTable({
    eventId: v.id('events'),
    locale: v.string(), // "de|fr|it|rm|en"
    title: v.string(),
    description: v.optional(v.string()),
    venueDisplayName: v.optional(v.string()),
    priceDisplay: v.optional(v.string()),
    organizerName: v.optional(v.string()),

    origin: v.string(), // "source|machine|human"
    quality: v.optional(v.number()), // 0..1
    provenance: v.optional(v.string()), // which URL/doc produced this
    updatedAt: v.number(),
  })
    .index('by_event_locale', ['eventId', 'locale'])
    .index('by_locale', ['locale']),

  /**
   * USERS & ALERTS: basic personalization for digests and push later (Expo).
   */
  users: defineTable({
    email: v.string(),
    externalId: v.string(),
    firstName: v.union(v.string(), v.null()),
    lastName: v.union(v.string(), v.null()),
    emailVerified: v.boolean(),
    homeLat: v.optional(v.number()),
    homeLng: v.optional(v.number()),
    homeGeohash5: v.optional(v.string()),
    kidsAges: v.optional(v.array(v.number())),
    prefs: v.optional(v.any()),
    expoPushToken: v.optional(v.string()),
  })
    .index('by_email', ['email'])
    .index('by_external_id', ['externalId']),

  alerts: defineTable({
    userId: v.id('users'),
    radiusKm: v.number(), // 20|30|40
    categories: v.array(v.string()),
    age: v.optional(v.number()),
    daysAhead: v.number(), // e.g., 14
    enabled: v.boolean(),
  }).index('by_user', ['userId']),

  /**
   * RUNS: observability for workflows (crawl/parse/extract/notify).
   */
  runs: defineTable({
    kind: v.string(), // "crawl|parse|extract|notify|repair"
    ref: v.optional(v.string()), // source/doc/event id
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    ok: v.optional(v.boolean()),
    meta: v.optional(v.any()),
  })
    .index('by_kind', ['kind'])
    .index('by_started', ['startedAt']),
});
