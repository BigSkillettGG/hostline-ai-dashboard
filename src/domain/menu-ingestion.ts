export interface ParsedMenuCategory {
  items: ParsedMenuItem[];
  name: string;
}

export interface ParsedMenuItem {
  available: boolean;
  description?: string;
  modifiers?: string[];
  name: string;
  prepMinutes: number;
  priceCents: number;
  upsellSuggestions?: string[];
}

interface PriceMatch {
  cents: number;
  itemText: string;
}

const defaultCategoryName = "Imported Menu";
const defaultPrepMinutes = 10;

export function parseMenuText(text: string): ParsedMenuCategory[] {
  const categories: ParsedMenuCategory[] = [];
  let currentCategory: ParsedMenuCategory | undefined;
  let lastItem: ParsedMenuItem | undefined;
  let previousLineWasBlank = true;

  for (const rawLine of text.split(/\r?\n/)) {
    const cleanedLine = cleanMenuLine(rawLine);

    if (!cleanedLine) {
      previousLineWasBlank = true;
      continue;
    }

    const modifier = parseModifierLine(cleanedLine);
    if (modifier && lastItem) {
      lastItem.modifiers = appendUnique(lastItem.modifiers, modifier);
      previousLineWasBlank = false;
      continue;
    }

    const priceMatch = extractTrailingPrice(cleanedLine);
    if (priceMatch) {
      if (!currentCategory) {
        currentCategory = createCategory(defaultCategoryName);
        categories.push(currentCategory);
      }

      const { description, name } = splitNameAndDescription(priceMatch.itemText);
      if (!name) {
        previousLineWasBlank = false;
        continue;
      }

      lastItem = {
        available: true,
        description,
        name,
        prepMinutes: defaultPrepMinutes,
        priceCents: priceMatch.cents,
      };
      currentCategory.items.push(lastItem);
      previousLineWasBlank = false;
      continue;
    }

    if (lastItem && currentCategory && !previousLineWasBlank && !looksLikeCategoryHeading(cleanedLine)) {
      lastItem.description = [lastItem.description, cleanedLine].filter(Boolean).join(" ");
      previousLineWasBlank = false;
      continue;
    }

    currentCategory = createCategory(cleanCategoryName(cleanedLine));
    categories.push(currentCategory);
    lastItem = undefined;
    previousLineWasBlank = false;
  }

  return categories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => item.name && item.priceCents >= 0),
    }))
    .filter((category) => category.items.length > 0);
}

export function normalizeMenuName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function parsePriceCents(value: string): number | undefined {
  const normalized = value.replace(/[$,\s]/g, "");
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(normalized)) return undefined;

  const dollars = Number.parseFloat(normalized);
  if (!Number.isFinite(dollars) || dollars < 0) return undefined;
  return Math.round(dollars * 100);
}

function createCategory(name: string): ParsedMenuCategory {
  return {
    items: [],
    name: name || defaultCategoryName,
  };
}

function cleanMenuLine(line: string) {
  return normalizeMenuName(
    line
      .replace(/^[\s>*#]+/, "")
      .replace(/^\d+[).]\s+/, "")
      .replace(/^(?:-|\u2022)\s+/, "")
      .replace(/\s+/g, " "),
  );
}

function cleanCategoryName(line: string) {
  return normalizeMenuName(line.replace(/:$/, ""));
}

function extractTrailingPrice(line: string): PriceMatch | undefined {
  const match = line.match(/(?:^|[\s(])(\$?\s*\d{1,5}(?:,\d{3})*(?:\.\d{1,2})?)(?:\)?\s*)$/);
  if (!match || match.index === undefined) return undefined;

  const cents = parsePriceCents(match[1]);
  if (cents === undefined) return undefined;

  const itemText = line
    .slice(0, match.index)
    .replace(/[.\-:|]+$/, "")
    .trim();

  if (!itemText) return undefined;
  return { cents, itemText };
}

function splitNameAndDescription(value: string) {
  const normalized = normalizeMenuName(value);
  const match = normalized.match(/^(.+?)(?:\s+-\s+|\s+:\s+)(.+)$/);

  if (!match) {
    return { name: normalized };
  }

  return {
    description: normalizeMenuName(match[2]),
    name: normalizeMenuName(match[1]),
  };
}

function parseModifierLine(line: string) {
  const normalized = normalizeMenuName(line.replace(/^[-+]\s+/, ""));

  if (/^(add|sub|substitute|no|extra|light|side|choice of|modifiers?:|options?:)/i.test(normalized)) {
    return normalized.replace(/^(modifiers?|options?):\s*/i, "");
  }

  return undefined;
}

function looksLikeCategoryHeading(line: string) {
  const normalized = cleanCategoryName(line);
  const words = normalized.split(/\s+/).filter(Boolean);

  if (line.endsWith(":")) return true;
  if (normalized.length > 48 || /[.,;]/.test(normalized)) return false;
  if (words.length === 0 || words.length > 6) return false;
  if (/\b(with|served|topped|includes|contains|choice)\b/i.test(normalized)) return false;

  const letters = normalized.replace(/[^a-z]/gi, "");
  const uppercaseLetters = letters.replace(/[^A-Z]/g, "");
  if (letters.length >= 3 && uppercaseLetters.length / letters.length > 0.75) return true;

  return words.every((word) => /^[A-Z0-9&+/]/.test(word));
}

function appendUnique(current: string[] | undefined, value: string) {
  const items = current ?? [];
  return items.some((item) => item.toLowerCase() === value.toLowerCase()) ? items : [...items, value];
}
