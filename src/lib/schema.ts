import { pgTable, text, timestamp, uuid, boolean, jsonb, integer, real } from 'drizzle-orm/pg-core';

// Users table for authentication
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  name: text('name'),
  emailVerified: boolean('email_verified').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sites = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  name: text('name').notNull(),
  domain: text('domain').notNull(),
  apiKey: text('api_key').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  // Site context for AI analysis
  businessType: text('business_type'),
  description: text('description'),
  targetAudience: text('target_audience'),
  primaryGoals: jsonb('primary_goals'), // Array of goals as JSON
  pageContext: jsonb('page_context'), // Object mapping paths to descriptions
});

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').references(() => sites.id).notNull(),
  sessionId: text('session_id').notNull(),
  visitorId: text('visitor_id').notNull(),
  eventType: text('event_type').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  url: text('url').notNull(),
  path: text('path').notNull(),
  referrer: text('referrer'),
  deviceType: text('device_type'),
  userAgent: text('user_agent'),
  screenWidth: integer('screen_width'),
  screenHeight: integer('screen_height'),
  viewportWidth: integer('viewport_width'),
  viewportHeight: integer('viewport_height'),
  language: text('language'),
  timezone: text('timezone'),
  eventData: jsonb('event_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  siteId: uuid('site_id').references(() => sites.id).notNull(),
  visitorId: text('visitor_id').notNull(),
  startedAt: timestamp('started_at').notNull(),
  endedAt: timestamp('ended_at'),
  duration: integer('duration'),
  pageViews: integer('page_views').default(0).notNull(),
  clicks: integer('clicks').default(0).notNull(),
  maxScrollDepth: real('max_scroll_depth').default(0),
  entryPage: text('entry_page'),
  exitPage: text('exit_page'),
  referrer: text('referrer'),
  deviceType: text('device_type'),
  isBounce: boolean('is_bounce').default(true),
  // Geolocation fields
  country: text('country'),
  region: text('region'), // State/province
  city: text('city'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insights = pgTable('insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').references(() => sites.id).notNull(),
  type: text('type').notNull(),
  severity: text('severity'),
  title: text('title').notNull(),
  description: text('description').notNull(),
  metric: text('metric'),
  value: real('value'),
  previousValue: real('previous_value'),
  changePercent: real('change_percent'),
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  isRead: boolean('is_read').default(false),
  isDismissed: boolean('is_dismissed').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Screenshots table for on-demand page captures
export const screenshots = pgTable('screenshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').references(() => sites.id).notNull(),
  sessionId: text('session_id').notNull(),
  eventId: uuid('event_id').references(() => events.id),
  path: text('path').notNull(),
  url: text('url').notNull(),
  imageData: text('image_data').notNull(), // Base64 encoded image
  width: integer('width'),
  height: integer('height'),
  deviceType: text('device_type'),
  capturedAt: timestamp('captured_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Password reset tokens for forgot password flow
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// User flows table (kept for potential future use)
export const userFlows = pgTable('user_flows', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').references(() => sites.id).notNull(),
  sessionId: text('session_id').notNull(),
  visitorId: text('visitor_id').notNull(),
  startedAt: timestamp('started_at').notNull(),
  endedAt: timestamp('ended_at'),
  duration: integer('duration'),
  totalEvents: integer('total_events').default(0).notNull(),
  pagesVisited: integer('pages_visited').default(0).notNull(),
  totalClicks: integer('total_clicks').default(0).notNull(),
  entryPage: text('entry_page'),
  exitPage: text('exit_page'),
  deviceType: text('device_type'),
  country: text('country'),
  flowPath: jsonb('flow_path'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
