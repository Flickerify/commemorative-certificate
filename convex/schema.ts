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
  domain: v.string(),
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
  sourceId: v.id('sources'),
  lang: languageValidator,
  config: v.any(), // config object used for the scrapper.
  version: v.number(),
  enabled: v.boolean(),
  notes: v.optional(v.string()),
  updatedAt: v.number(),
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
    .index('by_domain', ['domain'])
    .index('by_location', ['locationId'])
    .index('by_hash', ['hash']),

  // Per-site crawler configuration (YAML-style, stored as JSON)
  profiles: profiles.index('by_source', ['sourceId']).index('by_enabled', ['enabled']),

  users: users.index('by_external_id', ['externalId']).index('by_email', ['email']),
});
