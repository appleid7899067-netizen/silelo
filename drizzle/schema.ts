import { bigint, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/** Core user table backing the Manus OAuth flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/**
 * All conversations intentionally use one fixed room key: "silelo".
 * The server never accepts a caller-provided room, so a second room cannot be created through this app.
 */
export const chatEvents = mysqlTable("chat_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  roomKey: varchar("roomKey", { length: 32 }).notNull().default("silelo"),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  detail: text("detail"),
  status: mysqlEnum("status", ["running", "success", "error", "waiting_confirmation", "cancelled"]).notNull().default("success"),
  createdAtUtc: bigint("createdAtUtc", { mode: "number" }).notNull().default(0),
});

export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  roomKey: varchar("roomKey", { length: 32 }).notNull().default("silelo"),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  provider: varchar("provider", { length: 64 }),
  model: varchar("model", { length: 128 }),
  status: mysqlEnum("status", ["complete", "error"]).notNull().default("complete"),
  traceId: varchar("traceId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdAtUtc: bigint("createdAtUtc", { mode: "number" }).notNull().default(0),
  clientCreatedAt: bigint("clientCreatedAt", { mode: "number" }),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ChatEvent = typeof chatEvents.$inferSelect;
export type InsertChatEvent = typeof chatEvents.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
