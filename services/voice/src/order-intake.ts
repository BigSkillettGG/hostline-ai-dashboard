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

export interface OrderCaptureOptions {
  requireIntent?: boolean;
}

export interface OrderChangeResult {
  changed: boolean;
  items: CapturedOrderItem[];
  summary?: string;
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

const orderSubmitPattern =
  /\b(that'?s all|that is all|that'?ll be all|nothing else|no thanks|complete|submit|send it|place it|put it through|go ahead|name is|under)\b/i;

export function hasOrderIntent(utterance: string) {
  return orderIntentPattern.test(normalize(utterance));
}

export function hasOrderSubmitIntent(utterance: string) {
  return orderSubmitPattern.test(normalize(utterance));
}

export function capturePickupOrder(
  utterance: string,
  context: RestaurantVoiceContext,
  options: OrderCaptureOptions = {},
): CapturedOrder | null {
  const normalizedUtterance = normalize(utterance);
  const requireIntent = options.requireIntent ?? true;
  if (requireIntent && !orderIntentPattern.test(normalizedUtterance)) return null;

  const items = captureMenuItems(normalizedUtterance, context.menuItems);
  if (!items.length) return null;

  return {
    confidence: Math.min(95, 65 + items.length * 10),
    customerName: captureCustomerName(utterance),
    items,
    notes: "SignalHost-created staff-review pickup order. Staff should confirm before kitchen production.",
  };
}

export function summarizeCapturedOrderItems(items: CapturedOrderItem[]) {
  return items.map((item) => `${item.quantity} ${item.name}`).join(", ");
}

export function calculateCapturedOrderTotalCents(items: CapturedOrderItem[]) {
  return items.reduce((total, item) => total + item.priceCents * item.quantity, 0);
}

export function formatCapturedOrderTotal(items: CapturedOrderItem[]) {
  return formatUsd(calculateCapturedOrderTotalCents(items));
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

export function applyOrderChangeRequest(
  existingItems: CapturedOrderItem[],
  utterance: string,
  context: RestaurantVoiceContext,
): OrderChangeResult {
  if (!existingItems.length) return { changed: false, items: existingItems };

  const normalizedUtterance = normalize(utterance);
  const matchedItems = captureMenuItems(normalizedUtterance, context.menuItems);
  if (!matchedItems.length) return { changed: false, items: existingItems };

  const matchedNames = new Set(matchedItems.map((item) => item.name));
  if (/\b(remove|cancel|take off|scratch|drop|no longer|don't want|do not want)\b/.test(normalizedUtterance)) {
    const items = existingItems.filter((item) => !matchedNames.has(item.name));
    return {
      changed: items.length !== existingItems.length,
      items,
      summary: `Removed ${matchedItems.map((item) => item.name).join(", ")} from the draft order.`,
    };
  }

  if (/\b(make that|make it|change(?: that| it)? to|instead of|actually)\b/.test(normalizedUtterance)) {
    let changed = false;
    const quantityByName = new Map(matchedItems.map((item) => [item.name, item.quantity]));
    const items = existingItems.map((item) => {
      const quantity = quantityByName.get(item.name);
      if (!quantity || quantity === item.quantity) return item;
      changed = true;
      return { ...item, quantity };
    });

    return {
      changed,
      items,
      summary: changed
        ? `Updated ${matchedItems.map((item) => `${item.name} to ${item.quantity}`).join(", ")}.`
        : undefined,
    };
  }

  return { changed: false, items: existingItems };
}

function captureMenuItems(utterance: string, menuItems: RestaurantMenuItem[]) {
  const normalizedUtterance = normalize(utterance);
  const capturedItems: CapturedOrderItem[] = [];

  for (const menuItem of menuItems) {
    const aliases = [menuItem.name, ...(menuItem.aliases ?? [])].map(normalize);
    const matchedAlias = findMenuItemMatch(normalizedUtterance, aliases);
    if (!matchedAlias) continue;

    capturedItems.push({
      modifiers: captureModifiers(normalizedUtterance, menuItem),
      name: menuItem.name,
      priceCents: menuItem.priceCents,
      quantity: captureQuantityBeforeIndex(normalizedUtterance, matchedAlias.index),
    });
  }

  return capturedItems;
}

interface MenuItemMatch {
  index: number;
}

function findMenuItemMatch(normalizedUtterance: string, aliases: string[]): MenuItemMatch | null {
  for (const alias of aliases) {
    const index = normalizedUtterance.indexOf(alias);
    if (index >= 0) return { index };
  }

  return aliases
    .map((alias) => findFuzzyAliasMatch(normalizedUtterance, alias))
    .filter((match): match is MenuItemMatch => Boolean(match))
    .sort((left, right) => left.index - right.index)[0] ?? null;
}

function findFuzzyAliasMatch(normalizedUtterance: string, alias: string): MenuItemMatch | null {
  const aliasWords = alias.split(/\s+/).filter(Boolean);
  if (alias.length < 6 || !aliasWords.length) return null;

  const utteranceWords = normalizedUtterance.split(/\s+/).filter(Boolean);
  const windowSizes = Array.from(new Set([aliasWords.length, aliasWords.length + 1])).filter(
    (size) => size <= utteranceWords.length,
  );
  const maxDistance = Math.max(1, Math.floor(alias.length * 0.24));

  for (const size of windowSizes) {
    for (let start = 0; start <= utteranceWords.length - size; start += 1) {
      const candidate = utteranceWords.slice(start, start + size).join(" ");
      if (Math.abs(candidate.length - alias.length) > maxDistance + 2) continue;
      if (levenshteinDistance(candidate, alias) <= maxDistance) {
        return {
          index: wordIndex(normalizedUtterance, start),
        };
      }
    }
  }

  return null;
}

function captureQuantityBeforeIndex(normalizedUtterance: string, aliasIndex: number) {
  const prefix = normalizedUtterance.slice(0, aliasIndex).trim();
  const words = prefix.split(/\s+/).filter(Boolean).slice(-6);

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

export function captureCustomerName(utterance: string) {
  const match = utterance.match(
    /\b(?:name is|name's|under(?: the name)?|for pickup under)\s+([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+)?)/i,
  );
  return match?.[1] ? titleCaseName(match[1]) : undefined;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function mergeModifiers(left?: string[], right?: string[]) {
  const merged = Array.from(new Set([...(left ?? []), ...(right ?? [])]));
  return merged.length ? merged : undefined;
}

function titleCaseName(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}

function levenshteinDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }

    for (let index = 0; index < previous.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[right.length];
}

function wordIndex(value: string, wordOffset: number) {
  if (wordOffset <= 0) return 0;

  let seenWords = 0;
  for (let index = 0; index < value.length; index += 1) {
    const startsWord = value[index] !== " " && (index === 0 || value[index - 1] === " ");
    if (!startsWord) continue;
    if (seenWords === wordOffset) return index;
    seenWords += 1;
  }

  return value.length;
}
