import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { ChatEvent, ChatMessage, InsertChatEvent, InsertChatMessage, InsertUser, chatEvents, chatMessages, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.


export const SINGLE_ROOM_DB_KEY = "silelo" as const;

export async function getChatMessages(userId: number, limit = 80): Promise<ChatMessage[]> {
  const db = await getDb();
  if (!db) return [];
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  const rows = await db.select().from(chatMessages)
    .where(and(eq(chatMessages.userId, userId), eq(chatMessages.roomKey, SINGLE_ROOM_DB_KEY)))
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(safeLimit);
  return rows.reverse();
}

export async function getChatEvents(userId: number, limit = 40): Promise<ChatEvent[]> {
  const db = await getDb();
  if (!db) return [];
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const rows = await db.select().from(chatEvents)
    .where(and(eq(chatEvents.userId, userId), eq(chatEvents.roomKey, SINGLE_ROOM_DB_KEY)))
    .orderBy(desc(chatEvents.createdAtUtc), desc(chatEvents.id))
    .limit(safeLimit);
  return rows.reverse();
}

export async function addChatEvent(input: Omit<InsertChatEvent, "roomKey" | "createdAtUtc"> & { roomKey?: string; createdAtUtc?: number }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const values: InsertChatEvent = { ...input, roomKey: SINGLE_ROOM_DB_KEY, createdAtUtc: input.createdAtUtc || Date.now() };
  await db.insert(chatEvents).values(values);
}

export async function addChatMessage(input: Omit<InsertChatMessage, "roomKey"> & { roomKey?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  const values: InsertChatMessage = {
    ...input,
    roomKey: SINGLE_ROOM_DB_KEY,
    createdAtUtc: Date.now(),
  };
  await db.insert(chatMessages).values(values);
  const rows = await db.select().from(chatMessages)
    .where(and(eq(chatMessages.userId, input.userId), eq(chatMessages.roomKey, SINGLE_ROOM_DB_KEY)))
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(1);
  return rows[0];
}
