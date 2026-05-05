import { describe, expect, it } from "vitest";
import { parseMenuText, parsePriceCents } from "./menu-ingestion";

describe("menu ingestion", () => {
  it("parses categories, items, prices, and descriptions from pasted menu text", () => {
    const categories = parseMenuText(`
Starters
Burrata - Heirloom tomato, basil, olive oil $16
Caesar Salad - Little gem, parmesan 14

Wood-fired Pizza
Margherita - Tomato, mozzarella, basil 18.00
Diavola - Spicy salami, chili, mozzarella $21
`);

    expect(categories).toHaveLength(2);
    expect(categories[0]).toMatchObject({
      name: "Starters",
      items: [
        {
          description: "Heirloom tomato, basil, olive oil",
          name: "Burrata",
          priceCents: 1600,
        },
        {
          description: "Little gem, parmesan",
          name: "Caesar Salad",
          priceCents: 1400,
        },
      ],
    });
    expect(categories[1].items.map((item) => item.name)).toEqual(["Margherita", "Diavola"]);
  });

  it("attaches modifier lines to the previous item", () => {
    const categories = parseMenuText(`
Pizza
Margherita $18
Add gluten-free crust +$4
No cheese
`);

    expect(categories[0].items[0]).toMatchObject({
      modifiers: ["Add gluten-free crust +$4", "No cheese"],
      name: "Margherita",
    });
  });

  it("keeps continuation lines as item descriptions", () => {
    const categories = parseMenuText(`
Pasta
Cacio e Pepe $22
Tonnarelli, pecorino, black pepper
`);

    expect(categories[0].items[0]).toMatchObject({
      description: "Tonnarelli, pecorino, black pepper",
      name: "Cacio e Pepe",
    });
  });

  it("creates a default category when a pasted menu starts with items", () => {
    const categories = parseMenuText(`
House Red glass $12
Sparkling Water 5
`);

    expect(categories).toEqual([
      {
        items: [
          {
            available: true,
            name: "House Red glass",
            prepMinutes: 10,
            priceCents: 1200,
          },
          {
            available: true,
            name: "Sparkling Water",
            prepMinutes: 10,
            priceCents: 500,
          },
        ],
        name: "Imported Menu",
      },
    ]);
  });

  it("normalizes supported price formats", () => {
    expect(parsePriceCents("$16")).toBe(1600);
    expect(parsePriceCents("18.5")).toBe(1850);
    expect(parsePriceCents("1,250.99")).toBe(125099);
    expect(parsePriceCents("free")).toBeUndefined();
  });
});
