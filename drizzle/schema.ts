import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const now = () => new Date();
export const POST_STATUSES = ["draft", "pending_review", "scheduled", "published"] as const;
export const ADMIN_ROLES = ["admin", "editor"] as const;

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("open_id").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("login_method"),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  lastSignedIn: integer("last_signed_in", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  imageUrl: text("image_url"),
  headline: text("headline").notNull(),
  body: text("body").notNull(),
  status: text("status", { enum: POST_STATUSES }).notNull().default("draft"),
  scheduledTime: integer("scheduled_time", { mode: "timestamp_ms" }),
  publishedTime: integer("published_time", { mode: "timestamp_ms" }),
  rejectionNote: text("rejection_note"),
  createdBy: integer("created_by").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

export const adminUsers = sqliteTable("admin_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ADMIN_ROLES }).notNull().default("editor"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  rememberDeviceToken: text("remember_device_token"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

export const readers = sqliteTable("readers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  googleId: text("google_id").unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  verificationToken: text("verification_token"),
  resetToken: text("reset_token"),
  resetTokenExpires: integer("reset_token_expires", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

export const postViews = sqliteTable("post_views", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id").notNull(),
  readerId: integer("reader_id"),
  viewedAt: integer("viewed_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

export const searchQueries = sqliteTable("search_queries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  query: text("query").notNull(),
  searchedAt: integer("searched_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type AdminUser = typeof adminUsers.$inferSelect;
export type Reader = typeof readers.$inferSelect;
export type PostView = typeof postViews.$inferSelect;
export type SearchQuery = typeof searchQueries.$inferSelect;
