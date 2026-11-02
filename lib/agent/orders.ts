import crypto from "crypto";
import { getDoc, putDoc } from "../db";

export type ServiceId = "health_check" | "media_plan" | "seo_audit";
export type OrderStatus = "queued" | "running" | "done" | "error";

export interface Order {
  id: string;
  apiKeyId: string;
  service: ServiceId;
  status: OrderStatus;
  input: unknown;
  result: unknown;
  // Hälsokoll och mediaplan sparas också som analys, så att resultatet
  // går att visa för en människa på /analys/<id>
  analysisId: string | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

const COLLECTION = "orders";
const STALE_MS = 10 * 60 * 1000;

export async function createOrder(
  apiKeyId: string,
  service: ServiceId,
  input: unknown
): Promise<Order> {
  const order: Order = {
    id: `ord_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    apiKeyId,
    service,
    status: "queued",
    input,
    result: null,
    analysisId: null,
    error: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
  };
  await saveOrder(order);
  return order;
}

export async function getOrder(id: string): Promise<Order | null> {
  return getDoc<Order>(COLLECTION, id);
}

export async function saveOrder(order: Order): Promise<void> {
  await putDoc(COLLECTION, order.id, order);
}

// Ett bakgrundsjobb som dödats av plattformen hinner aldrig skriva sitt
// fel. Därför avgörs det i efterhand, när någon frågar efter ordern.
export function markStale(order: Order, now = new Date()): Order {
  const active = order.status === "queued" || order.status === "running";
  const started = Date.parse(order.startedAt ?? order.createdAt);
  if (!active || now.getTime() - started <= STALE_MS) return order;
  return {
    ...order,
    status: "error",
    error: "Jobbet tog för lång tid",
    finishedAt: now.toISOString(),
  };
}
