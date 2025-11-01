import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

export const roleValidator = v.optional(v.union(...Object.values(ROLES).map(v.literal)));

export const LANGUAGES = {
  DE: 'de',
  FR: 'fr',
  IT: 'it',
  RM: 'rm',
  EN: 'en',
} as const;

export const languageValidator = v.union(...Object.values(LANGUAGES).map(v.literal));

export const DOC_STATUSES = {
  NEW: 'new',
  PARSED: 'parsed',
  EXTRACTED: 'extracted',
  ERROR: 'error',
} as const;

export const docStatusValidator = v.union(...Object.values(DOC_STATUSES).map(v.literal));

export const PARSED_STATUSES = {
  NEW: 'new',
  EXTRACTED: 'extracted',
  ERROR: 'error',
} as const;

export const parsedStatusValidator = v.union(...Object.values(PARSED_STATUSES).map(v.literal));

export const QUEUE_STATUSES = {
  PENDING: 'pending',
  FETCHED: 'fetched',
  ERROR: 'error',
} as const;

export const queueStatusValidator = v.union(...Object.values(QUEUE_STATUSES).map(v.literal));

export const CATEGORIES = {
  KIDS: 'kids',
  SPORT: 'sport',
  CULTURE: 'culture',
  MARKET: 'market',
  MUSIC: 'music',
  EDU: 'edu',
  OTHER: 'other',
} as const;

export const categoryValidator = v.union(...Object.values(CATEGORIES).map(v.literal));

export const PRICE_TYPES = {
  FREE: 'free',
  PAID: 'paid',
  DONATION: 'donation',
  UNKNOWN: 'unknown',
} as const;

export const priceTypeValidator = v.union(...Object.values(PRICE_TYPES).map(v.literal));

export const SOURCE_KINDS = {
  PDF: 'pdf',
  HTML: 'html',
  ICS: 'ics',
  API: 'api',
  MANUAL: 'manual',
} as const;

export const sourceKindValidator = v.union(...Object.values(SOURCE_KINDS).map(v.literal));

export const TEXT_ORIGINS = {
  SOURCE: 'source',
  MACHINE: 'machine',
  HUMAN: 'human',
} as const;

export const textOriginValidator = v.union(...Object.values(TEXT_ORIGINS).map(v.literal));

export const ALERT_CADENCES = {
  HOURLY: 'hourly',
  DAILY: 'daily',
  WEEKLY: 'weekly',
} as const;

export const alertCadenceValidator = v.union(...Object.values(ALERT_CADENCES).map(v.literal));

export const RUN_KINDS = {
  CRAWL: 'crawl',
  PARSE: 'parse',
  EXTRACT: 'extract',
  NOTIFY: 'notify',
  REPAIR: 'repair',
} as const;

export const runKindValidator = v.union(...Object.values(RUN_KINDS).map(v.literal));

export const REVIEW_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  FIXED: 'fixed',
} as const;

export const reviewStatusValidator = v.union(...Object.values(REVIEW_STATUSES).map(v.literal));

export const PLACE_KINDS = {
  CITY: 'city',
  VENUE: 'venue',
} as const;

export const placeKindValidator = v.union(...Object.values(PLACE_KINDS).map(v.literal));

export const ENTITY_TYPES = {
  COMMUNE: 'commune',
  ASSOCIATION: 'association',
  VENUE: 'venue',
  DEPARTMENT: 'department',
  OTHER: 'other',
} as const;

export const entityTypeValidator = v.union(...Object.values(ENTITY_TYPES).map(v.literal));

// ============================================================
// LOCATIONS (normalized administrative regions)
// ============================================================

export const locations = defineTable({
  slugName: v.string(),
  country: v.string(), // ISO 3166-1 alpha-2: "CH", "DE", "FR", etc.
  region: v.optional(v.string()), // First-level admin division: canton, state, province, etc.
  subRegion: v.optional(v.string()), // Second-level admin division: commune, city, district, etc.
  city: v.optional(v.string()), // Third-level admin division: city, town, village, etc.
  postalCode: v.optional(v.string()),
  language: v.array(languageValidator),
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
  geohash5: v.optional(v.string()),
  geohash7: v.optional(v.string()),
  timezone: v.string(), // IANA timezone: "Europe/Zurich", "Europe/Berlin", etc.
  externalId: v.optional(v.string()), // Country-specific external ID (e.g., BFS id for CH)
  notes: v.optional(v.string()),
  updatedAt: v.number(),
});

// ============================================================
// SOURCES & CRAWLER CONFIGURATION
// ============================================================

export const sources = defineTable({
  url: v.string(),
  name: v.optional(v.string()),
  entityType: v.optional(entityTypeValidator),
  locationId: v.optional(v.id('locations')), // Reference to normalized location
  lang: v.optional(languageValidator),
  profileId: v.optional(v.id('profiles')),
  enabled: v.boolean(),
  hash: v.string(), // dedupe key (url hash)
  lastFetchAt: v.optional(v.number()),
  etag: v.optional(v.string()),
  lastModified: v.optional(v.string()),
  notes: v.optional(v.string()),
  updatedAt: v.number(),
});

export const profiles = defineTable({
  siteId: v.string(), // e.g., "gemeinde-zug"
  domain: v.string(),
  lang: languageValidator,
  config: v.any(), // config object used for the scrapper.
  version: v.number(),
  enabled: v.boolean(),
  notes: v.optional(v.string()),
  updatedAt: v.number(),
});

// ============================================================
// INGESTION PIPELINE
// ============================================================

export const docs = defineTable({
  sourceId: v.id('sources'),
  r2Key: v.string(), // path in R2 bucket
  sha256: v.string(),
  mime: v.string(),
  sizeBytes: v.optional(v.number()),
  fetchedAt: v.number(),
  status: docStatusValidator,
  error: v.optional(v.string()),
  updatedAt: v.number(),
});

export const parsed = defineTable({
  docId: v.id('docs'),
  r2Key: v.string(), // parsed JSONL in R2
  lang: languageValidator,
  blockCount: v.number(),
  ocrUsed: v.boolean(),
  parsedAt: v.number(),
  status: parsedStatusValidator,
  error: v.optional(v.string()),
});

export const details_queue = defineTable({
  sourceId: v.id('sources'),
  url: v.string(),
  urlHash: v.string(), // dedupe
  meta: v.optional(v.any()), // snippet from list (title, date_block, ...)
  status: queueStatusValidator,
  attempts: v.number(),
  lastAttempt: v.optional(v.number()),
  error: v.optional(v.string()),
  updatedAt: v.number(),
});

// ============================================================
// EVENTS (language-neutral facts)
// ============================================================

export const events = defineTable({
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
  category: v.optional(categoryValidator),
  ageMin: v.optional(v.number()),
  ageMax: v.optional(v.number()),
  priceType: v.optional(priceTypeValidator),
  priceAmount: v.optional(v.string()), // e.g., "CHF 5–10"

  // Media
  images: v.optional(v.array(v.string())),
  attachments: v.optional(v.array(v.string())),

  // Provenance & Quality
  sourceLanguage: languageValidator,
  sourceKind: sourceKindValidator,
  contentHash: v.string(), // for dedupe
  confidence: v.optional(v.number()), // 0..1
  verified: v.boolean(), // passed validation
  cancelled: v.boolean(),

  updatedAt: v.number(),
});

export const event_i18n = defineTable({
  eventId: v.id('events'),
  locale: languageValidator,
  title: v.string(),
  subtitle: v.optional(v.string()),
  description: v.optional(v.string()),
  venueDisplayName: v.optional(v.string()),
  priceDisplay: v.optional(v.string()),
  organizerName: v.optional(v.string()),
  origin: textOriginValidator,
  quality: v.optional(v.number()), // 0..1
  provenance: v.optional(v.string()), // source URL/doc id
  updatedAt: v.number(),
});

// ============================================================
// PLACES (optional: normalized cities/venues)
// ============================================================

export const places = defineTable({
  kind: placeKindValidator,
  externalId: v.optional(v.string()), // BFS id, etc.
  lat: v.number(),
  lng: v.number(),
  geohash5: v.string(),
  geohash7: v.string(),
});

export const place_i18n = defineTable({
  placeId: v.id('places'),
  locale: languageValidator,
  name: v.string(),
  slug: v.optional(v.string()),
});

// ============================================================
// USERS & ALERTS
// ============================================================

export const users = defineTable({
  email: v.string(),
  externalId: v.string(),
  firstName: v.union(v.string(), v.null()),
  lastName: v.union(v.string(), v.null()),
  emailVerified: v.boolean(),
  profilePictureUrl: v.union(v.string(), v.null()),
  role: roleValidator, // User role: USER or ADMIN
  // Home location
  homeLat: v.optional(v.number()),
  homeLng: v.optional(v.number()),
  homeGeohash5: v.optional(v.string()),
  homeCityId: v.optional(v.string()),
  // Preferences
  kidsAges: v.optional(v.array(v.number())),
  preferredLocale: v.optional(languageValidator),
  prefs: v.optional(v.any()),
  // Mobile
  expoPushToken: v.optional(v.string()),
  updatedAt: v.number(),
});

export const alerts = defineTable({
  userId: v.id('users'),
  radiusKm: v.number(), // 20|30|40
  categories: v.array(categoryValidator),
  age: v.optional(v.number()), // filter events for this age
  daysAhead: v.number(), // e.g., 14 (look 2 weeks ahead)
  cadence: alertCadenceValidator,
  enabled: v.boolean(),
  lastSentAt: v.optional(v.number()),
  updatedAt: v.number(),
});

// ============================================================
// WORKFLOWS & OBSERVABILITY
// ============================================================

export const runs = defineTable({
  kind: runKindValidator,
  ref: v.optional(v.string()), // source/doc/profile id
  startedAt: v.number(),
  finishedAt: v.optional(v.number()),
  ok: v.optional(v.boolean()),
  meta: v.optional(v.any()), // counts, errors, etc.
  error: v.optional(v.string()),
});

export const reviews = defineTable({
  eventId: v.id('events'),
  reason: v.string(), // "low_confidence|date_mismatch|missing_location|..."
  status: reviewStatusValidator,
  assignedTo: v.optional(v.id('users')),
  notes: v.optional(v.string()),
  resolvedAt: v.optional(v.number()),
});

export default defineSchema({
  // Normalized locations for multi-country support
  locations: locations
    .index('by_country', ['country'])
    .index('by_country_region', ['country', 'region'])
    .index('by_external', ['externalId'])
    .index('slugName', ['slugName'])
    .searchIndex('search_city', {
      searchField: 'subRegion',
      filterFields: ['country'],
      staged: false,
    }),

  sources: sources
    .index('by_enabled', ['enabled'])
    .index('by_url', ['url'])
    .index('by_location', ['locationId'])
    .index('by_hash', ['hash']),

  // Per-site crawler configuration (YAML-style, stored as JSON)
  profiles: profiles.index('by_site', ['siteId']).index('by_enabled', ['enabled']),

  // Raw documents (HTML/PDF) stored in R2
  docs: docs.index('by_source', ['sourceId']).index('by_status', ['status']).index('by_sha256', ['sha256']),

  // Parsed text blocks (OCR/HTML extraction) stored in R2
  parsed: parsed.index('by_doc', ['docId']).index('by_status', ['status']),

  // Queue for detail page fetches (list → detail)
  details_queue: details_queue.index('by_status', ['status']).index('by_hash', ['urlHash']),

  events: events
    .index('by_hash', ['contentHash'])
    .index('by_start', ['start'])
    .index('by_geo7_start', ['geohash7', 'start'])
    .index('by_city_start', ['cityId', 'start'])
    .index('by_verified', ['verified'])
    .index('by_category', ['category']),

  // Localized text per event
  event_i18n: event_i18n
    .index('by_event_locale', ['eventId', 'locale'])
    .index('by_locale', ['locale'])
    .index('by_origin', ['origin']),

  places: places.index('by_kind', ['kind']).index('by_external', ['externalId']),

  place_i18n: place_i18n.index('by_place_locale', ['placeId', 'locale']),

  users: users.index('by_external_id', ['externalId']).index('by_email', ['email']),

  alerts: alerts.index('by_user', ['userId']).index('by_enabled', ['enabled']),

  runs: runs.index('by_kind', ['kind']).index('by_time', ['startedAt']).index('by_ref', ['ref']),

  // Optional: human review queue for low-confidence events
  reviews: reviews.index('by_status', ['status']).index('by_event', ['eventId']),
});
