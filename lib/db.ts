import { promises as fs } from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// All lagring går genom två funktioner. Med SUPABASE_URL och
// SUPABASE_SERVICE_ROLE_KEY hamnar dokumenten i tabellen `documents`
// (se supabase/documents.sql). Utan dem sparas de som JSON-filer under
// data/<samling>/, så att lokal utveckling och testerna fungerar utan databas.

const TABLE = "documents";

function isValidId(id: string): boolean {
  return /^[a-z0-9_-]{4,80}$/i.test(id);
}

let client: SupabaseClient | null | undefined;

function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return client;
}

function filePath(collection: string, id: string): string {
  return path.join(process.cwd(), "data", collection, `${id}.json`);
}

export async function putDoc<T>(collection: string, id: string, data: T): Promise<void> {
  if (!isValidId(id)) throw new Error(`Ogiltigt id: ${id}`);
  const db = supabase();
  if (db) {
    const { error } = await db
      .from(TABLE)
      .upsert({ collection, id, data, updated_at: new Date().toISOString() });
    if (error) throw new Error(`Kunde inte spara ${collection}/${id}: ${error.message}`);
    return;
  }
  const file = filePath(collection, id);
  await fs.mkdir(path.dirname(file), { recursive: true });
  // Skriv till en temporär fil och byt namn, så att ingen läser en halvskriven fil
  const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

export async function getDoc<T>(collection: string, id: string): Promise<T | null> {
  if (!isValidId(id)) return null;
  const db = supabase();
  if (db) {
    const { data, error } = await db
      .from(TABLE)
      .select("data")
      .eq("collection", collection)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Kunde inte läsa ${collection}/${id}: ${error.message}`);
    return (data?.data as T) ?? null;
  }
  try {
    return JSON.parse(await fs.readFile(filePath(collection, id), "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
