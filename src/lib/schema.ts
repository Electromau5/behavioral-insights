import { pgTable, text, timestamp, integer, jsonb, uuid, boolean, real } from 'drizzle-orm/pg-core';

export const sites = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  domain: text('domain').notNull(),
  apiKey: text('api_key').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
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

// User flows table to store computed flow summaries
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
  flowPath: jsonb('flow_path'), // Array of {type, path, timestamp, details}
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
