# Grailbox

A photo-first personal vault for pop-culture collectors. Log what you own, spot what you want, and check whether you already own something before you buy it. Built from `HANDOFF.md` and the Grailbox design canvas.

The app is single-user, offline-first and on-device only. There are no accounts, no sync and no network calls. Photos never leave the phone.

## Run it

```sh
npm install
npx expo run:ios        # or: npx expo run:android  (development build)
```

Expo SDK 58, React Native 0.88, TypeScript strict. A development build is recommended. Phase 2 of the scanner will need one anyway, because it adds an on-device ML runtime.

Open **Settings** (the gear on the Dashboard) and tap **Load sample data** to seed the canvas data: 3 collections, the 8 Rowlet items and 3 journal entries.

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint (`eslint-config-expo`) |
| `npm run type-check` | `tsc --noEmit` |
| `npm test` | Jest: repositories against real SQLite, money and date helpers, the wishlist sheet, similarity ranking |
| `npm run e2e` | Maestro flows in `.maestro/` (needs a simulator or device with a build installed) |
| `npm run db:generate` | Generate a Drizzle migration after editing `src/db/schema.ts` |

CI (`.github/workflows/ci.yml`) runs lint, type-check, tests and an iOS + Android bundle on every push.

## Status by milestone

| # | Milestone | Status |
| --- | --- | --- |
| 1 | Foundation | Done. Theme tokens, fonts, icon set, schema and migrations, seed data, CI. |
| 2 | Browse | Done. Launch screen, Dashboard, Gallery, Item Details, search and filters. |
| 3 | Capture and edit | Done. Wishlist sheet, item, collection and journal forms, photo capture/import with 1080 px and 256 px copies, per-item currency, artist/shop link, Export. |
| 4 | Journal | Done. Timeline, entry screen, entry form with photos and tagged items. |
| 5 | Scanner, phase 1 | Done. Camera, corner guides, four banner states, barcode matching, flash, haptics, "Search instead". |
| 6 | Scanner, phase 2 | **Not done.** The reference-photo table, Mark as Dupe Check and the tested ranking code exist. No model is chosen and no threshold is set (see below). |

### What has and has not been verified

- **Verified here:** lint, type-check, 32 Jest tests, and Metro bundles for iOS and Android. `expo-doctor` passes all 20 checks. Every screen was also rendered with react-native-web at 390×844 and compared with its canvas frame.
- **Not verified here:** no iOS simulator or Android emulator was available in the build environment. These have not been run yet:
  - the native build itself
  - the Maestro flows
  - the camera and barcode scanning
  - photo capture
  - haptics
  - the Export share sheet
  - the performance target (500 items in under 300 ms on a mid-range Android phone)

  Run `npm run e2e` on a device build. The flows take the screenshots each milestone asks for.

## Architecture

```
src/
  app/                 expo-router routes (thin: each renders a feature screen)
  db/                  schema.ts, database.ts, client.ts, repositories/, seed.ts, useQuery.ts
  features/            collections/ items/ wishlist/ journal/ scanner/ settings/ launch/
  components/          ui.tsx (buttons, chips, segmented control, photo tile), form.tsx, Sheet.tsx, Icons.tsx
  lib/                 money, currencies, dates, photos, export, navigation helpers
  theme.ts             every design token from the handoff
drizzle/               generated SQL migrations (0000_init, 0001_search)
.maestro/              end-to-end flows
```

Screens read data through repository functions wrapped in `useQuery`. Every repository write calls `notifyChange()`, and mounted queries then refetch. There is no network layer. All IDs are UUID strings.

### Routes

| Route | Screen |
| --- | --- |
| `/` | 00 Launch screen, then replaces itself with the Dashboard |
| `/dashboard` | 02 Collections Dashboard (`?search=1` focuses search) |
| `/wishlist/new` | 01 Spot a Wishlist Item (modal; `?collectionId`, `?fromItem`, `?barcode`) |
| `/scanner` | 06 Scanner & Dupe Verifier (full-screen modal) |
| `/collection/:id` | 03 Collection Gallery |
| `/collection/:id/journal` | 05 Progress Journal (switching tabs replaces the route, so it never stacks) |
| `/item/:id` | 04 Item Details & Provenance |
| `/journal/:entryId` | 05a Journal Entry |
| `/item/form`, `/collection/form`, `/journal/form` | Create and edit forms (modal; `?id` to edit) |
| `/settings` | Export and sample data |

## Decisions and assumptions

The handoff asks for a record of every choice. Items marked **(deviation)** differ from the handoff's suggestion.

**Data**

- The stack follows the handoff: Expo, expo-router, expo-sqlite with Drizzle ORM and migrations, expo-image, Reanimated, react-native-svg and Plus Jakarta Sans.
- Item `specs` are flattened into columns (`release_year`, `manufacturer`, `size`, `barcode`) so the barcode can be indexed. Repositories map them back to the `specs` object.
- Collections have a `sort_order` column for Reorder. Counts and preview photos are always derived and never stored.
- **(deviation)** Photo paths are stored relative to the app's document directory (`photos/<uuid>.jpg`), not as absolute `file://` URIs. iOS changes the container path between app updates. Each photo also has a `_256.jpg` thumbnail beside it.
- **Search** uses FTS5 with `unicode61 remove_diacritics 2`, so "pokemon" matches "Pokémon". Every word must match, as a prefix. The FTS table is standalone and keyed by `item_id`, not external-content. `items` has a text primary key, so its implicit rowid can change on VACUUM.
- expo-sqlite's web build has no FTS5. The web preview therefore skips that migration and searches with `LIKE`. This path is tested too.
- Duplicate copies are `quantity` on one item, as decided. The Dashboard and tally counts count items, not copies.
- Changing an item to Wishlist clears its condition, and changing it away from Wishlist clears its priority, as the data model says.
- `item_embeddings` is the phase 2 table named in the handoff. Its `vector` column stays empty until a model exists.

**Screens**

- **(deviation)** The Dashboard header has a third icon button, a gear for **Settings**. The canvas shows only Scan and Spot, but Export needs an entry point.
- The Dashboard's filter button opens status pills (Any, Owned, Wishlist, In transit). Choosing a status with an empty search lists every item with that status across all collections, which is a quick way to see the whole wishlist. The Gallery's filter button does the same inside one collection.
- ••• → **Reorder** switches the Dashboard into a reorder mode with up and down buttons per collection, then Done. Delete asks for confirmation and removes the photo files too.
- Card footer: "Updated Oct 2026 · Latest: <title of the most recently acquired owned item>". A collection with no items shows one sentence instead of the chips and photo row.
- Gallery items are listed newest first. The seed inserts items in reverse so the order matches the canvas.
- "Collecting since" uses the earliest acquisition date. When there is none, the Journal subtitle falls back to the tally.
- A Milestone that is not a grail gets a white node with an outline star. The handoff defines node styles only for the other cases.
- For a Batch addition, "N new additions uploaded" counts tagged items, or the photos when nothing is tagged. When an entry has no photos of its own, its collage and hero use the tagged items' cover photos.
- In Item Details, a wishlist item shows a "Wishlist details" card (target price) instead of "Acquisition history". A "Priority" chip joins the chip row.
- Share uses the OS share sheet. iOS shares the photo and the title together. Android shares the photo file when one exists, otherwise the text.
- Prices are formatted as typed with grouping and the currency's minor-unit digits (JPY 0, KWD 3). Input always uses "." as the decimal point. Display uses `Intl.NumberFormat` in the device locale and the item's own currency. The ISO 4217 list is bundled because Hermes lacks `Intl.supportedValuesOf`.
- Photos imported in a form that is then cancelled are deleted. Photos removed from a record are deleted when it is saved.

**Export**

- **(deviation)** Export is one zip, not two files: `grailbox.json` plus a `photos/` folder. The paths in the JSON match the paths in the zip. Thumbnails are left out because they can be rebuilt. The zip is streamed to disk one photo at a time with `fflate`, so a large collection does not need to fit in memory.

**Launch and icon**

- The native splash (mint background, capsule logo) is configured in `app.json` with a dark variant. The reveal then plays on first render.
- The native splash centres the logo, while the reveal settles it 40 px above centre. Expect a small shift.
- With Reduce Motion on, the final frame shows for 0.7 s and the app moves on.
- App icon assets were generated from the canvas's chosen "Capsule Star" SVG. They are the iOS icon, an Android adaptive foreground plus a monochrome layer, and both splash images.

## Testing the scanner (phase 1)

The seed gives two items made-up barcodes. Print them (or show them on another screen) with any EAN-13 generator:

| Code | Item | Expected banner |
| --- | --- | --- |
| `4521329266181` | Rowlet Jumbo Plush | Already owned, "1 in Grailbox — Shelf B, Display Case 1" |
| `4521329311119` | Rowlet Juggling Plush | On wishlist, priority High |
| any other code | — | No match, with "Add to collection" and "Spot for wishlist" (both carry the scanned code) |

Numeric codes match across UPC-A, EAN-13 and GTIN-14 forms, which differ only by leading zeros. An owned copy wins over a wishlist entry with the same code.

Results are announced to screen readers as alerts. Already owned plays a warning haptic and On wishlist plays a success haptic.

## Phase 2: what is left

The handoff says not to ship a threshold that has not been tested on real photos. That needs a device and a photo set, so phase 2 stops at the parts that do not depend on the model:

- `item_embeddings` table, and **Mark as Dupe Check** on Item Details, which adds the item's photos to the reference set.
- `src/features/scanner/similarity.ts`: cosine similarity, best score per item, top-k ranking, and the threshold decision (top match, or No match with the 3 closest). Covered by tests.
- `setEmbedding` / `listVectors` in `src/db/repositories/embeddings.ts` to store vectors as `Float32Array` bytes.
- The model: DINOv2 ViT-S/14 (Apache-2.0) at 224 px with fp16 weights, in `assets/models/dinov2_vits14.tflite` (44 MB). It outputs a 384-value vector. `scripts/export_dinov2.py` rebuilds it (`uv run scripts/export_dinov2.py`) and checks its output against PyTorch.
- The runtime: `react-native-fast-tflite`, using the GPU delegate on Android and Core ML on iOS, with a CPU fallback. Its config plugin is in `app.json`, so this needs a new development build.
- `src/features/scanner/preprocess.ts`: center-square crop, ImageNet normalization into a float32 NHWC tensor, and L2 normalization. Covered by tests.
- `src/features/scanner/embedder.ts`: `embedImage(uri)` crops and resizes with expo-image-manipulator, decodes the JPEG with `jpeg-js`, runs the model and returns a unit vector. Nothing calls it yet.

To finish:

1. Embed each reference photo when it is saved or marked, and embed the captured frame at scan time.
2. Photograph at least 30 owned items from new angles, then measure top-1 accuracy across thresholds. Record the measured rate here and set the threshold.

## Accessibility notes

- Every control is a real button or link with a label. Icon-only buttons carry names such as "Scan an item for duplicates".
- Segmented controls are tab lists with a selected state. Filter pills expose their selected state.
- Status chips always carry their word.
- `text-muted` is used for placeholders and disabled text only.
- Touch targets are at least 44 × 44, using hit slop where the drawn control is smaller.
- Text scales with the system size. Long titles wrap and maker lines truncate.
- Reduce Motion skips the launch reveal, the scanner sweep and the progress bar animation.
- Safe areas are respected on every edge, and there is no fake status bar.

## Web preview

Web is not a target. A preview still works for design review with `npx expo start --web`. Camera and photo capture do not work there.

expo-sqlite's web worker needs wasm and SharedArrayBuffer. `metro.config.js` adds wasm support and the COOP/COEP headers. In this setup the dev server did not put those headers on the HTML page itself, so the screenshot harness added them. Headless Chrome also needed expo-sqlite's longer sync wait (`Atomics.pause` removed).
