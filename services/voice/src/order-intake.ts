import type { RestaurantMenuItem, RestaurantVoiceContext } from "./restaurant-context";

export interface CapturedOrderItem {
  name: string;
  quantity: number;
  priceCents: number;
  modifiers?: string[];
}

export interface CapturedOrder {
  confidence: number;
  customerName?: string;
  items: CapturedOrderItem[];
  notes: string;
}

const numberWords: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const orderIntentPattern =
  /\b(place (?:a )?(?:pickup |takeout )?order|pickup order|pick up order|takeout order|take out order|to go order|order for pickup|i d like|i would like|i want|can i get|could i get|can i have|let me get|i ll have|we ll have|we d like)\b/i;

export function capturePickupOrder(utterance: string, context: RestaurantVoiceContext): CapturedOrder | null {
  const normalizedUtterance = normalize(utterance);
  if (!orderIntentPattern.test(normalizedUtterance)) return null;

  const items = captureMenuItems(normalizedUtterance, context.menuItems);
  if (!items.length) return null;

  return {
    confidence: Math.min(95, 65 + items.length * 10),
    customerName: captureCustomerName(utterance),
    items,
    notes: "AI-created staff-review pickup order. Staff should confirm before kitchen production.",
  };
}

export function mergeCapturedOrderItems(
  existingItems: CapturedOrderItem[],
  newItems: CapturedOrderItem[],
): CapturedOrderItem[] {
  const merged = new Map<string, CapturedOrderItem>();

  for (const item of [...existingItems, ...newItems]) {
    const current = merged.get(item.name);
    if (!current) {
      merged.set(item.name, { ...item });
      continue;
    }

    merged.set(item.name, {
      ...current,
      modifiers: mergeModifiers(current.modifiers, item.modifiers),
      quantity: current.quantity + item.quantity,
    });
  }

  return Array.from(merged.values());
}

function captureMenuItems(utterance: string, menuItems: RestaurantMenuItem[]) {
  const normalizedUtterance = normalize(utterance);
  const capturedItems: CapturedOrderItem[] = [];

  for (const menuItem of menuItems) {
    const aliases = [menuItem.name, ...(menuItem.aliases ?? [])].map(normalize);
    const matchedAlias = aliases.find((alias) => normalizedUtterance.includes(alias));
    if (!matchedAlias) continue;

    capturedItems.push({
      modifiers: captureModifiers(normalizedUtterance, menuItem),
      name: menuItem.name,
      priceCents: menuItem.priceCents,
      quantity: captureQuantityBeforeAlias(normalizedUtterance, matchedAlias),
    });
  }

  return capturedItems;
}

function captureQuantityBeforeAlias(normalizedUtterance: string, alias: string) {
  const aliasIndex = normalizedUtterance.indexOf(alias);
  const prefix = normalizedUtterance.slice(0, aliasIndex).trim();
  const words = prefix.split(/\s+/).filter(Boolean).slice(-4);

  for (let i = words.length - 1; i >= 0; i -= 1) {
    const word = words[i].replace(/[^a-z0-9]/g, "");
    if (/^\d+$/.test(word)) return Math.min(Number(word), 20);
    if (numberWords[word]) return numberWords[word];
  }

  return 1;
}

function captureModifiers(normalizedUtterance: string, menuItem: RestaurantMenuItem) {
  const modifiers = (menuItem.modifiers ?? []).filter((modifier) =>
    normalizedUtterance.includes(normalize(modifier).replace(/\s+\+\d+$/, "")),
  );
  return modifiers.length ? modifiers : undefined;
}

function captureCustomerName(utterance: string) {
  const match = utterance.match(/\b(?:name is|under|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  return match?.[1];
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function mergeModifiers(left?: string[], right?: string[]) {
  const merged = Array.from(new Set([...(left ?? []), ...(right ?? [])]));
  return merged.length ? merged : undefined;
}
