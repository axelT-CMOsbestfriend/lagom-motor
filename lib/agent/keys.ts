import crypto from "crypto";
import { getDoc, putDoc } from "../db";

// API-nycklar för agenter som beställer av Lagom HQ. Bara hashen
// sparas, så en läckt databas avslöjar inga nycklar. Hashen är också
// dokumentets id, så uppslaget blir en enda läsning.
export interface ApiKey {
  id: string;
  name: string;
  quota: number;
  used: number;
  createdAt: string;
  revokedAt: string | null;
}

const COLLECTION = "api_keys";

function hash(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export async function createKey(
  name: string,
  quota: number
): Promise<{ key: string; record: ApiKey }> {
  const key = `lagom_${crypto.randomBytes(16).toString("hex")}`;
  const record: ApiKey = {
    id: hash(key),
    name,
    quota,
    used: 0,
    createdAt: new Date().toISOString(),
    revokedAt: null,
  };
  await putDoc(COLLECTION, record.id, record);
  return { key, record };
}

export async function findKey(rawKey: string): Promise<ApiKey | null> {
  if (!/^lagom_[0-9a-f]{32}$/.test(rawKey)) return null;
  const record = await getDoc<ApiKey>(COLLECTION, hash(rawKey));
  return record && !record.revokedAt ? record : null;
}

// Läser om nyckeln innan den räknar, så att ett gammalt objekt inte skriver
// över en senare förbrukning. Två exakt samtidiga beställningar kan ändå
// båda gå igenom, vilket är godtagbart för en kvot på ett tjugotal.
export async function consumeQuota(key: ApiKey): Promise<boolean> {
  const current = await getDoc<ApiKey>(COLLECTION, key.id);
  if (!current || current.revokedAt || current.used >= current.quota) return false;
  await putDoc(COLLECTION, current.id, { ...current, used: current.used + 1 });
  return true;
}

export async function refundQuota(keyId: string): Promise<void> {
  const current = await getDoc<ApiKey>(COLLECTION, keyId);
  if (!current || current.used === 0) return;
  await putDoc(COLLECTION, keyId, { ...current, used: current.used - 1 });
}
