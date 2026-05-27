## What's wrong now

The host card is a full hero panel: 28-pixel avatar in its own 8-padding column, gradient backdrop, two blur orbs, eyebrow + name + status pill stacked, subtitle, two-column ContactRow grid, then a separate "Message Elliot" button row. That stack forces the card to ~260px tall and makes Quick Actions next to it look stranded. It's decorative, not informational.

## Fix: compact single-row host strip

Collapse the host card into a single horizontal strip — about a third of its current height — that sits as a slim band, with Quick Actions becoming the visual anchor of the top section.

### Host card changes (`src/pages/Dashboard.tsx` ~lines 290–356)

- Drop the `lg:col-span-2` — make the host card and Quick Actions equal width (`lg:grid-cols-2`), or keep host slightly larger with `lg:grid-cols-[1fr_1fr]`.
- Remove the gradient backdrop layer, both blur orbs, and the inner `md:grid-cols-[auto_1fr]` split with its dedicated avatar column.
- One row, left to right: small avatar (h-12 w-12, no glow ring, keep the status dot), then a tight info block — name + status badge inline on one line, "Call or text your host" as a single muted caption underneath.
- Replace the two-column ContactRow grid with two inline icon-links on one row: `📞 +1 (415) 555-0142` · `✉️ elliot+olive-ember@signalhost.ai`. Both are `<a>` tags, no card chrome, no labels above values.
- Remove the "Message Elliot" button entirely from the card. Messaging Elliot already lives in the assistant route; if you want it surfaced, add it as a fourth Quick Action instead — but my recommendation is to drop it from the hero since "Call or text" is the primary channel and the Owner Assistant has its own sidebar entry.
- Remove the "Your SignalHost host" eyebrow label — redundant with the name + avatar.
- Card padding goes from `p-6 md:p-8` to `p-4`. Total height target: ~96–110px.

### Quick Actions card changes (same grid)

- Now equal width. Keep the 3 actions + the "Set up website chat" to-do block.
- The to-do block keeps the amber treatment and stays as the visual focal point of the top row.

### Result

Top section becomes two short equal cards (~140–160px tall) instead of one tall hero card + one short list. The dashboard's actual content (Needs Attention, stats, etc.) gets the vertical real estate it deserves.

## Out of scope

- No changes to data, routing, or the hero strip above (`bg-[image:var(--gradient-hero)]` page header at line 235 stays — that's the real hero).
- No changes to Quick Actions content beyond the equal-width grid.
- No backend changes.

## Files touched

- `src/pages/Dashboard.tsx` only.

Approve and I'll implement.
