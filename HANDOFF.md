# Grailbox — Engineering Handoff (Mobile MVP)

Oct 17, 2026 · @Dan

## Summary

Build the Grailbox mobile MVP: a photo-first personal vault where pop-culture collectors log what they own, spot what they want, and check in under 5 seconds whether they already own an item before buying it.

- **Users:** collectors of plushies, artist goods, figures and blind boxes (Pokémon, music artists, VTubers). They shop in stores, at conventions and on second-hand markets, often one-handed.
- **Design source:** the [Grailbox design canvas](https://claude.ai/code/artifact/68345bee-324b-4911-be9f-b8025d3d303b) holds 8 phone screens (390×844) linked as a clickable prototype, plus the chosen app icon. It is private to the product owner; every value you need is copied into this doc.
- **How to use this doc:** treat the tokens, data model and screen behaviors as the spec. Where this doc and the canvas disagree, the canvas wins on visuals and this doc wins on behavior. Anything marked as an assumption you may change; record what you chose.
- **Product principle:** no completion bars or percentages anywhere. Collections are open-ended; show counts, never progress toward a total.

## Scope

The MVP is 8 screens on one device, single user, offline-first.

| # | Screen | Route | Canvas frame |
| --- | --- | --- | --- |
| 00 | Launch screen | (native splash + first render) | 00 · Launch Screen |
| 02 | Collections Dashboard (home) | `/dashboard` | 02 · Collections Dashboard |
| 01 | Spot a Wishlist Item (modal sheet) | `/wishlist/new` | 01 · Wishlist New Collectible |
| 06 | Scanner & Dupe Verifier | `/scanner` | 06 · Scanner & Dupe Verifier |
| 03 | Collection Gallery | `/collection/:id` | 03 · Collection Gallery |
| 04 | Item Details & Provenance | `/item/:id` | 04 · Item Details & Provenance |
| 05 | Progress Journal | `/collection/:id/journal` | 05 · Progress Journal |
| 05a | Journal Entry (expanded) | `/journal/:entryId` | 05a · Journal Entry (Expanded) |

**Also in scope:** create and edit flows for collections, items and journal entries (reuse the wishlist sheet's form patterns), local photo capture and import, search across all items, and an Export action in Settings (JSON plus a zip of photos) as the only backup. An item's status (Owned, Wishlist, In transit) is set manually in its form.

**Out of scope for the MVP:** accounts and cloud sync, sharing to other users (Share buttons may use the OS share sheet only), a marketplace or price database, dark mode for app screens (the launch screen has a dark variant), tablets, and completion tracking of any kind.

## Suggested stack and architecture

Use Expo (React Native + TypeScript) with a local SQLite database, so one codebase ships to iOS and Android and the app works offline in stores and convention halls. This stack is a recommendation, not a decision: swap a piece if you have a strong reason, and note it in the README.

| Concern | Recommendation | Why |
| --- | --- | --- |
| App framework | Expo, current stable SDK, TypeScript strict | One codebase; camera, files and splash handled by first-party modules |
| Navigation | expo-router (file-based) | Routes map 1:1 to the paths in Scope; modal presentation for the wishlist sheet |
| Database | expo-sqlite + Drizzle ORM, with migrations from day one | Offline-first; typed queries; schema in section Data model |
| Search | SQLite FTS5 over item title, line/manufacturer, source, storage location | Sub-second search on device |
| Photos | expo-camera (scanner), expo-image-picker (capture/import), expo-file-system (store in the app's document directory), expo-image-manipulator (thumbnails at 256 px and 1080 px) | Photos stay on device; the DB stores file paths only |
| Image display | expo-image | Caching and fast thumbnails in grids |
| Fonts | Plus Jakarta Sans via @expo-google-fonts/plus-jakarta-sans (400, 500, 600, 700, 800) | The type face used on every canvas screen |
| Icons | react-native-svg, with the stroke icons from the canvas redrawn as components (24×24 grid, 1.7–2 px stroke, round caps) | Matches the drawn icons; no emoji |
| Animation | react-native-reanimated | Launch reveal, scanner sweep, sheet motion |
| Testing | Jest + React Native Testing Library; Maestro for end-to-end flows | Covers the acceptance criteria in Build plan |

**Architecture:** a thin data layer (`/db`: schema, migrations, repositories per entity) under feature folders (`/features/collections`, `/items`, `/wishlist`, `/journal`, `/scanner`). Screens read through repository hooks; no network layer in the MVP. Keep IDs as UUID strings so a later cloud sync can adopt them unchanged.

## Design tokens

Put these in one `theme.ts` and reference tokens by name everywhere. The look is minimalist light mode: borderless, airy, with merch photos as the only strong color.

### Color

| Token | Hex | Use |
| --- | --- | --- |
| surface-canvas | #F8FAFC | App background |
| surface-card | #FFFFFF | Cards, sheets |
| surface-subtle | #F1F5F9 | Inputs, inactive segments, icon buttons |
| text-primary | #0F172A | Titles, active labels |
| text-secondary | #64748B | Metadata, hints |
| text-muted | #94A3B8 | Placeholders and disabled text only (fails contrast for body text) |
| text-body | #334155 | Long-form notes |
| status-owned-bg / -text | #D1FAE5 / #065F46 | Owned chips |
| status-wish-bg / -text | #E0F2FE / #0369A1 | Wishlist chips and banner |
| status-alert-bg / -text | #FEF3C7 / #92400E | In transit chips, duplicate banner, Grail priority |
| origin-official-bg / -text | #E2E8F0 / #334155 | "Official" tag (added after the spec) |
| origin-fan-bg / -text | #EDE9FE / #5B21B6 | "Fan-made" tag (added after the spec) |
| brand-primary | #0F766E | Primary buttons and links. The spec said #0D9488; it was darkened because white 15 px text on #0D9488 fails 4.5:1 contrast |
| brand-mint | #CCFBF1 | Launch screen and app icon background |
| accent-star | #FBBF24 | The logo's star only |
| camera-ground | #141B24 | Scanner background behind the camera feed |

### Type (Plus Jakarta Sans)

| Style | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| Large title | 24 / 32 | 600, tracking −0.01em | Screen titles |
| Section heading | 18 / 26 | 600 | Card headings on Item Details |
| Card title | 15–16 / 20–22 | 500 | Collection names, item names, journal titles |
| Body / input | 14 / 20 | 400 | Fields, notes (journal entry note: 15 / 24) |
| Label | 13 / 18 | 500, text-secondary | Field labels, subtitles |
| Meta | 12 / 16 | 400–500 | Timestamps, maker lines |
| Chip | 11–12 / 16 | 500–700 | Status, origin and priority pills |
| Wordmark | 40 / 44 | 800, tracking −0.03em | "Grailbox" on the launch screen |

### Shape, depth, spacing

- **Radii:** cards 16–20; journal cards 18; inputs and buttons 12–14; thumbnails 12; chips, filters and segmented controls fully round (9999); app icon 22.5% of its size.
- **Shadow:** one ambient shadow only, `0 4px 20px -2px rgba(15, 23, 42, 0.05)`. Selected segments use `0 2px 8px -2px rgba(15, 23, 42, 0.12)`. No borders on cards.
- **Spacing:** screen gutter 20; gap between cards 16; inside cards 14–18; floating buttons sit 34 above the bottom edge (home indicator).
- **Touch targets:** at least 44×44 for every control, including icon-only buttons.
- **Photo placeholders:** until a photo exists, show a tinted tile with an image glyph. Tints rotate through #E4EFE7, #EFE8DD, #E6EEF5, #F1E6EC, #E9E6F3.

## Data model

The spec's three entities stand, with seven changes that the screens and product decisions need: a link to the artist or shop, an `origin` tag (Official / Fan-made), a per-item `category`, a `quantity` for duplicates, `item_ids` on journal entries, `condition` made optional for wishlist items, and collection counts derived instead of stored.

```typescript
type ItemStatus = 'OWNED' | 'WISHLIST' | 'IN_TRANSIT';
type Priority = 'GRAIL' | 'HIGH' | 'MEDIUM' | 'LOW';
type Condition = 'NWT' | 'LOOSE_MINT' | 'BOXED' | 'DISPLAY_ONLY';
type Origin = 'OFFICIAL' | 'FAN';            // Official vs Fan-made merch

interface Collection {
  id: string;                 // UUID
  name: string;               // "Rowlet Plushies & Merch"
  categories: string[];       // ordered filter pills: ["Plushies", "Figures", "Pin & Flat Merch"]
  created_at: string;         // ISO 8601
  updated_at: string;         // bump on any item or journal change in the collection
  // Derived in queries, never stored: owned_count, wishlist_count, in_transit_count,
  // preview_images (4 most recent owned photos)
}

interface CollectibleItem {
  id: string;
  collection_id: string;
  title: string;              // "Rowlet Jumbo Plush"
  line?: string;              // maker, brand, artist or shop name shown under the title
  line_url?: string;          // link to the artist's or shop's page; opens in the browser
  category?: string;          // one of the collection's categories
  status: ItemStatus;         // set manually by the user; no automatic transit tracking
  origin: Origin;             // default 'OFFICIAL'
  quantity: number;           // copies owned; a second copy = quantity 2, never a new item
  variant_tags: string[];     // "Jumbo size", "Japan release"
  priority?: Priority;        // wishlist items only
  estimated_price?: number;   // wishlist target price, minor units
  purchase_price?: number;    // minor units
  currency: string;           // ISO 4217, chosen per item (imports from any country);
                              // default from the device locale
  acquisition_date?: string;  // ISO date; UI shows month + year
  acquisition_source?: string;// "Pokémon Center Tokyo", "Surugaya"
  condition?: Condition;      // wishlist items have no condition
  storage_location?: string;  // "Shelf B, Display Case 1"
  specs: {
    release_year?: number;
    manufacturer?: string;
    size?: string;
    barcode?: string;         // barcode or SKU
  };
  photos: string[];           // local file URIs, first = cover
  created_at: string;
  updated_at: string;
}

interface JournalEntry {
  id: string;
  collection_id: string;
  date: string;               // ISO date; UI shows "Aug 2026"
  title: string;              // "Grail Found", "Shelf Refresh"
  notes?: string;
  entry_type: 'MILESTONE' | 'BATCH_ADD' | 'NOTE';
  is_grail?: boolean;         // shows the GRAIL chip and amber timeline node
  item_ids: string[];         // items tagged in the entry ("Tagged in this entry")
  photos: string[];
  created_at: string;
}
```

Store money as integers in minor units and format with `Intl.NumberFormat` (the canvas shows $35.00), always in the item's own currency. Index `items(collection_id, status)`, `items(barcode)` and `journal(collection_id, date DESC)`.

## Navigation

&#91;embedded content: navigation · 8 screens\]

Item Details is reached three ways: from the Gallery, from a scanner match and from a tagged item in a journal entry. Gallery and Journal are two tabs of one collection screen. The Wishlist sheet closes back to whichever screen opened it, and Back always returns to the previous screen.

## Screen specs

Each screen below lists its parts top to bottom, then its states and behaviors. Every list needs an empty state; the canvas shows only the filled state.

### 00 · Launch screen

- Background brand-mint (#CCFBF1); the capsule logo (no tile) 152 px, centered, 40 px above center; "Grailbox" wordmark; tagline "Every grail, accounted for." (final copy); three pulsing dots 84 px from the bottom.
- Motion, about 1.5 s total: capsule drops in and settles (0.9 s), star spins in on the seam (0.6 s, starts at 0.75 s), wordmark and tagline fade up (starts at 1.0 s), dots appear at 1.3 s.
- Configure the native splash with the same mint and logo so there is no flash; play the reveal on first render, then go to the Dashboard. Respect Reduce Motion: show the final frame without animating.
- Dark variant for dark system appearance: background #0F172A, white wordmark, tagline #99F6E4.

### 02 · Collections Dashboard (home)

- Header: "Grailbox" label over "Collections" large title; right side two 44 px icon buttons: Scan (opens 06) and Spot wishlist item (opens 01).
- Search pill (placeholder "Search items, lines, shelves") plus a filter icon button. Search covers every item in every collection and shows results as a list of item rows.
- Collection cards: name (taps through to 03) with a ••• menu (Rename, Reorder, Delete with confirm); count chips "28 Owned", "15 Wishlist", "2 In transit" (hide a chip at zero); a 4-up row of the latest owned photos; footer "Updated Oct 2026" plus an optional latest-acquisition note.
- Docked bottom button "+ New Collection" over a translucent canvas-colored bar; content scrolls under it.
- Empty state: no collections yet, one sentence and the New Collection button.

### 01 · Spot a Wishlist Item (modal sheet)

- Presented as a sheet with a grabber; top bar Cancel (left), "Spot a Wishlist Item" (center), Save (right, brand color). Save and the bottom "Add to Wishlist" button do the same thing.
- Fields in order: photo drop zone (dashed outline, "Add or snap a reference photo", opens camera or library); Item name; Target / estimated price with a currency picker per item (any ISO 4217 currency, default from the device locale), formatted as typed; Priority segmented control Grail / High / Medium / Low (default High; Grail selected shows amber); Merch type segmented control Official / Fan-made (default Official; Fan-made selected shows violet); Collection picker (default: the collection the user came from, else the most recent).
- Only Item name and Collection are required; disable Save until both are set. Creates an item with status WISHLIST.
- Reached from the Dashboard, from Item Details ("Add to Wishlist"), and from a scanner result.

### 06 · Scanner & Dupe Verifier

- Full-screen camera on #141B24 with four white rounded corner guides (272 px square) around the target area; Close (top left) and Flash toggle (top right, amber when on).
- Top banner has three states:
  - **Matching:** white card, spinner, "Matching against your Grailbox…", "Checking N items across M collections", indeterminate bar; a teal scan line sweeps the frame. Hint under it: "Hold steady — center the item in the frame".
  - **Already owned:** amber card, warning icon, "ALREADY OWNED", "1 in Grailbox — Shelf B" (quantity and storage location), plus a row with the matched item's photo, title, collection, condition and price, and a match-confidence pill.
  - **On wishlist:** sky card, star icon, "ON WISHLIST · PRIORITY: HIGH", "You wanted this!", plus the matched item row with its target price.
- Add a fourth state the canvas does not show: **No match**, a neutral white card offering "Add to collection" and "Spot for wishlist".
- Footer: primary button per state ("View Existing Item in Grailbox" opens 04; "View on Wishlist" opens the item); secondary "Scan Again" ("Cancel" while matching).
- Haptics: a warning haptic on Already owned, a success haptic on On wishlist.

### 03 · Collection Gallery

- Header: back, Share and Filter icon buttons; collection name as large title; tally line "45 items · 28 owned · 15 wishlist · 2 in transit".
- Gallery / Journal segmented switch (Journal opens 05; keep it as a tab switch, not a push).
- Horizontal filter pills from the collection's categories with counts: "All (45)", "Plushies (18)"… Selected pill is filled text-primary with white text. Filtering is instant.
- Two-column grid, gap 20 vertical × 12 horizontal: square photo (radius 16) with a status chip top-left (Owned / Wishlist / In transit); under it the title (15/20, 500) and a row with the origin tag (Official / Fan-made) and the line or maker, truncated with an ellipsis.
- Floating centered pill button "+ Add to Set" 34 px above the bottom; opens the add-item form.

### 04 · Item Details & Provenance

- Edge-to-edge hero photo, 404 px tall, swipeable with page dots; floating back and Edit buttons (white, 90% opacity, round).
- Content sheet overlaps the photo by 24 px: title; chip row with "Owned (1)" (quantity), "Official merch" or "Fan-made" with a badge icon, then variant tags. Under the title, the artist or shop name links to its page when a link is set.
- Specifications card: Release year, Manufacturer, Size, Barcode / SKU in a 2-column grid. Hide a field with no value.
- Acquisition history card: three rows with 40 px icon tiles: store and acquisition month; purchase price plus condition chip ("NWT · New with Tags"); storage location.
- Three equal action tiles: Mark as Dupe Check (adds the item's photo to the scanner's reference set), Add to Wishlist (opens 01 prefilled, for a second copy or variant), Share (OS share sheet with photo and title).

### 05 · Progress Journal

- Same header and switch as 03, with Journal selected; subtitle "Collecting since Dec 2019" (the earliest acquisition date).
- A vertical timeline, newest first: a dashed spine with a 28 px node per entry. Node style per type: BATCH\_ADD = white with a plus; MILESTONE with is\_grail = amber with a star; NOTE = subtle grey with lines.
- Card per type: BATCH\_ADD shows a 1 large + 2 small photo collage and "N new additions uploaded"; MILESTONE shows a 168 px full-width photo with a GRAIL chip, date line, title and note; NOTE is text only.
- Tapping any card opens 05a. Docked bottom button "+ Upload New Progress Photo / Set" opens the new-entry form.

### 05a · Journal Entry (expanded)

- 440 px hero photo with back, Share and Edit buttons and a "1 / 4" counter; a row of 4 thumbnails below the title switches the hero.
- Chips (GRAIL when is\_grail, then the entry type), title, "Aug 2026 · Rowlet Plushies & Merch".
- "Collector note" in 15/24 body text, full length.
- "Tagged in this entry": a row per tagged item (photo, title, status chip, maker · year, chevron) that opens 04.
- Earlier / Later cards at the bottom jump to the neighbouring entries in date order; hide one at either end of the timeline.

## Scanner and duplicate detection

Ship the scanner in two phases: exact matching on barcode and search first, visual matching second, behind the same four banner states. The goal is an answer within 5 seconds of opening the scanner.

1. **Phase 1, exact match.** Use the camera's built-in barcode reading. A barcode equal to an item's `specs.barcode` returns Already owned or On wishlist at once. Without a barcode, offer a "Search instead" link that opens the Dashboard search with the keyboard up. This phase alone covers boxed figures and blind boxes.
2. **Phase 2, visual match.** When an item photo is saved, compute an image embedding on device and store it in an `item_embeddings(item_id, photo_uri, vector)` table. At scan time, embed the captured frame and rank items by cosine similarity. Above a confidence threshold show the top match; below it show No match with the 3 closest items as suggestions. Brute-force search is fine at collection sizes in the low thousands.
3. **Model choice is open.** Evaluate a small mobile image-embedding model running through an on-device runtime (for example TensorFlow Lite or ONNX Runtime). This needs an Expo development build, not Expo Go. Measure accuracy on real plush photos taken from different angles before you set the threshold; do not ship a number you have not tested.
4. **Mark as Dupe Check** on Item Details adds that item's photos to the reference set, so the user can strengthen matching for the items they buy twice most often.

No photo leaves the device in either phase.

## Accessibility and quality bar

Every screen must pass these before a milestone counts as done.

- Text contrast at least 4.5:1 (3:1 at 24 px and up). text-muted is for placeholders only.
- Every control is a real button or link with an accessible label; icon-only buttons (Scan, Flash, Share, Edit, •••, back) carry labels such as "Scan an item for duplicates".
- Segmented controls and filter pills expose their selected state to screen readers.
- Status is never color alone: chips always carry their word (Owned, Wishlist, In transit, Official, Fan-made, GRAIL).
- Scanner results are announced as alerts; the matching state is announced as status.
- Dynamic Type: layouts hold at the largest standard size; long titles wrap, maker lines truncate.
- Reduce Motion: skip the launch reveal and scanner sweep.
- Safe areas respected on every edge. Do not draw a fake status bar.
- Performance: Dashboard and Gallery render in under 300 ms with 500 items and their thumbnails on a mid-range Android phone.

## Build plan

Build in six milestones, each ending in a runnable app and passing tests. Do them in order; each one depends on the one before.

1. **Foundation:** project setup, `theme.ts` with every token above, fonts, icon set, SQLite schema and migrations, seed data matching the canvas (3 collections, the 8 Rowlet items, 3 journal entries).
   - Done when: the app launches to an empty Dashboard on iOS and Android; a seed command fills it; lint, type-check and unit tests run in CI.
2. **Browse:** launch screen, Dashboard, Collection Gallery, Item Details, with search and category filters.
   - Done when: every screen matches its canvas frame side by side; counts are derived from items; filters and search return correct results on the seed data.
3. **Capture and edit:** Spot a Wishlist Item sheet, add/edit item, new/edit collection, photo capture and import with thumbnails, per-item currency, the artist or shop link, and Export.
   - Done when: a wishlist item is created in under 15 seconds from the Dashboard; Save stays disabled until name and collection are set; photos survive an app restart.
4. **Journal:** Progress Journal timeline, Journal Entry screen, new-entry form with photos and tagged items.
   - Done when: entries sort newest first; each entry type renders its own card and node; Earlier / Later walk the timeline in order.
5. **Scanner, phase 1:** camera, corner guides, the four banner states, barcode matching, "Search instead".
   - Done when: scanning a saved barcode shows Already owned or On wishlist within 2 seconds; an unknown code shows No match; flash toggles.
6. **Scanner, phase 2:** on-device embeddings, similarity ranking, threshold, Mark as Dupe Check.
   - Done when: on a test set of at least 30 owned items photographed from new angles, the right item is the top match for most of them at the chosen threshold; the measured rate is recorded in the README.

After each milestone, run the end-to-end flows in Maestro and attach screenshots of each screen next to its canvas frame.

## Product decisions

The product owner settled every open question on 18 Oct 2026; the sections above already reflect these answers.

| Question | Decision |
| --- | --- |
| Currency | Per item. Imports can come from any country, so every price field has its own currency (ISO 4217), defaulting to the device locale. |
| Sync and backup | Local only. An Export file (JSON + a zip of photos) is the backup. |
| In transit | Set manually by the user in the item form; no automatic tracking. |
| Duplicates | A second copy is quantity 2 on the same item, never a new item. |
| Fan-made merch | Each item gets an artist or shop name field and a link to the artist's or shop's page. |
| Wording in the scanner | Say "Grailbox", not "vault": "1 in Grailbox — Shelf B". |
| Launch tagline | "Every grail, accounted for." is final copy. |
| App name | Grailbox. The product owner checked: no app with that name exists yet. |
