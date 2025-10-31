import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

// Reusable literal unions
export const Language = v.union(v.literal('de'), v.literal('fr'), v.literal('it'), v.literal('rm'), v.literal('en'));

export const DocStatus = v.union(v.literal('new'), v.literal('parsed'), v.literal('extracted'), v.literal('error'));

export const ParsedStatus = v.union(v.literal('new'), v.literal('extracted'), v.literal('error'));

export const QueueStatus = v.union(v.literal('pending'), v.literal('fetched'), v.literal('error'));

export const Category = v.union(
  v.literal('kids'),
  v.literal('sport'),
  v.literal('culture'),
  v.literal('market'),
  v.literal('music'),
  v.literal('edu'),
  v.literal('other'),
);

export const PriceType = v.union(v.literal('free'), v.literal('paid'), v.literal('donation'), v.literal('unknown'));

export const SourceKind = v.union(
  v.literal('pdf'),
  v.literal('html'),
  v.literal('ics'),
  v.literal('api'),
  v.literal('manual'),
);

export const TextOrigin = v.union(v.literal('source'), v.literal('machine'), v.literal('human'));

export const AlertCadence = v.union(v.literal('hourly'), v.literal('daily'), v.literal('weekly'));

export const RunKind = v.union(
  v.literal('crawl'),
  v.literal('parse'),
  v.literal('extract'),
  v.literal('notify'),
  v.literal('repair'),
);

export const ReviewStatus = v.union(
  v.literal('pending'),
  v.literal('approved'),
  v.literal('rejected'),
  v.literal('fixed'),
);

export const PlaceKind = v.union(v.literal('city'), v.literal('venue'));

export const EntityType = v.union(
  v.literal('commune'),
  v.literal('association'),
  v.literal('venue'),
  v.literal('department'),
  v.literal('other'),
);

// ============================================================
// LOCATIONS (normalized administrative regions)
// ============================================================

export const locations = defineTable({
  country: v.string(), // ISO 3166-1 alpha-2: "CH", "DE", "FR", etc.
  region: v.optional(v.string()), // First-level admin division: canton, state, province, etc.
  subRegion: v.optional(v.string()), // Second-level admin division: commune, city, district, etc.
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
  entityType: v.optional(EntityType),
  locationId: v.optional(v.id('locations')), // Reference to normalized location
  lang: v.optional(Language),
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
  lang: Language,
  timezone: v.string(), // "Europe/Zurich"
  config: v.any(), // full YAML-like object: start_urls, item selectors, pagination, detail_page, etc.
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
  status: DocStatus,
  error: v.optional(v.string()),
  updatedAt: v.number(),
});

export const parsed = defineTable({
  docId: v.id('docs'),
  r2Key: v.string(), // parsed JSONL in R2
  lang: Language,
  blockCount: v.number(),
  ocrUsed: v.boolean(),
  parsedAt: v.number(),
  status: ParsedStatus,
  error: v.optional(v.string()),
});

export const details_queue = defineTable({
  sourceId: v.id('sources'),
  url: v.string(),
  urlHash: v.string(), // dedupe
  meta: v.optional(v.any()), // snippet from list (title, date_block, ...)
  status: QueueStatus,
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
  category: v.optional(Category),
  ageMin: v.optional(v.number()),
  ageMax: v.optional(v.number()),
  priceType: v.optional(PriceType),
  priceAmount: v.optional(v.string()), // e.g., "CHF 5–10"

  // Media
  images: v.optional(v.array(v.string())),
  attachments: v.optional(v.array(v.string())),

  // Provenance & Quality
  sourceLanguage: Language,
  sourceKind: SourceKind,
  contentHash: v.string(), // for dedupe
  confidence: v.optional(v.number()), // 0..1
  verified: v.boolean(), // passed validation
  cancelled: v.boolean(),

  updatedAt: v.number(),
});

export const event_i18n = defineTable({
  eventId: v.id('events'),
  locale: Language,
  title: v.string(),
  subtitle: v.optional(v.string()),
  description: v.optional(v.string()),
  venueDisplayName: v.optional(v.string()),
  priceDisplay: v.optional(v.string()),
  organizerName: v.optional(v.string()),
  origin: TextOrigin,
  quality: v.optional(v.number()), // 0..1
  provenance: v.optional(v.string()), // source URL/doc id
  updatedAt: v.number(),
});

// ============================================================
// PLACES (optional: normalized cities/venues)
// ============================================================

export const places = defineTable({
  kind: PlaceKind,
  externalId: v.optional(v.string()), // BFS id, etc.
  lat: v.number(),
  lng: v.number(),
  geohash5: v.string(),
  geohash7: v.string(),
});

export const place_i18n = defineTable({
  placeId: v.id('places'),
  locale: Language,
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
  // Home location
  homeLat: v.optional(v.number()),
  homeLng: v.optional(v.number()),
  homeGeohash5: v.optional(v.string()),
  homeCityId: v.optional(v.string()),
  // Preferences
  kidsAges: v.optional(v.array(v.number())),
  preferredLocale: v.optional(Language),
  prefs: v.optional(v.any()),
  // Mobile
  expoPushToken: v.optional(v.string()),
  updatedAt: v.number(),
});

export const alerts = defineTable({
  userId: v.id('users'),
  radiusKm: v.number(), // 20|30|40
  categories: v.array(Category),
  age: v.optional(v.number()), // filter events for this age
  daysAhead: v.number(), // e.g., 14 (look 2 weeks ahead)
  cadence: AlertCadence,
  enabled: v.boolean(),
  lastSentAt: v.optional(v.number()),
  updatedAt: v.number(),
});

// ============================================================
// WORKFLOWS & OBSERVABILITY
// ============================================================

export const runs = defineTable({
  kind: RunKind,
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
  status: ReviewStatus,
  assignedTo: v.optional(v.id('users')),
  notes: v.optional(v.string()),
  resolvedAt: v.optional(v.number()),
});

export default defineSchema({
  // Normalized locations for multi-country support
  locations: locations
    .index('by_country', ['country'])
    .index('by_country_region', ['country', 'region'])
    .index('by_external', ['externalId']),

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
