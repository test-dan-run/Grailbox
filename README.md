# Grailbox

A photo-first personal vault for pop-culture collectors. Log what you own, spot what you want, and check whether you already own something before you buy it. Built from `HANDOFF.md` and the Grailbox design canvas.

The app is single-user, offline-first and on-device only. There are no accounts, no sync and no network calls. Photos never leave the phone.

## Run it

```sh
npm install
npx expo run:ios        # or: npx expo run:android  (development build)
```

Expo SDK 58, React Native 0.88, TypeScript strict. The app needs a development build, not Expo Go, because the scanner's photo matching uses a native ML runtime. Build one with `npx eas-cli@latest build --profile development --platform android`, install the APK, then run `npx expo start --dev-client`.

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
| 6 | Scanner, phase 2 | **Working, threshold provisional.** Every item photo is embedded on device, and "Check this item" in the scanner matches by photo. It runs on a Galaxy S24+. The threshold has not been measured on the 30-item test yet (see below). |

### What has and has not been verified

- **Verified on a device (Galaxy S24+, Android 16, EAS development build, 2026-10-18):** the native build, photo import, the camera preview, and photo matching in the scanner (see Phase 2 below).
- **Verified here:** lint, type-check, 41 Jest tests, and Metro bundles for iOS and Android. `expo-doctor` passes all 20 checks. Every screen was also rendered with react-native-web at 390×844 and compared with its canvas frame.
- **Not verified yet:**
  - anything on iOS
  - the Maestro flows
  - barcode scanning (no barcoded item was at hand)
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
- `item_embeddings` is the phase 2 table named in the handoff. Every item photo gets a row. `vector` holds its embedding and `model` names the model that made it, so a model change recomputes old vectors instead of comparing across models.

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

Photo matching works end to end on a device. The threshold is still provisional, because the handoff says not to ship a threshold that has not been tested on real photos.

**How it works**

- The model is DINOv2 ViT-S/14 (Apache-2.0) at 224 px with fp16 weights, in `assets/models/dinov2_vits14.tflite` (44 MB). It outputs a 384-value vector. `uv run scripts/export_dinov2.py` rebuilds it and checks it against PyTorch.
- The runtime is `react-native-fast-tflite`, with a CPU fallback (`src/features/scanner/embedder.ts`). Model runs are queued, one at a time.
- `src/features/scanner/references.ts` keeps the reference set current. Every item photo gets a vector. It runs at launch and shortly after any data change, one photo at a time, and loads the model only when a photo needs it. Vectors from an older `EMBEDDING_MODEL` are recomputed.
- The scanner's **Check this item** takes one photo with no shutter sound and crops it to the area inside the corner guides (`frameCrop` in `preprocess.ts`). It then embeds the crop and ranks items by their best-scoring reference photo (`similarity.ts`). At or above `MATCH_THRESHOLD`, it shows Already owned or On wishlist. Below it, it shows No match with the 3 closest items, which open when tapped. Barcodes are still read live alongside.
- In development builds, the match pill shows the raw score, and Metro logs every check's timing and top scores (`[Scanner] …`).

**Measured on a Samsung Galaxy S24+ (SM-S926B, Exynos 2400, Android 16), development build, 2026-10-18**

| Step | Result |
| --- | --- |
| GPU delegate (`android-gpu`, OpenCL) | Fails, falls back to CPU. It accepts 40 of 721 ops (BROADCAST_TO, DEQUANTIZE and a rank-mismatched MUL are unsupported), then fails to prepare on a 1×1×384 CONCATENATION. |
| Model load | 1.5 s on CPU (2.6 s including the failed GPU attempt). Both include fetching 44 MB from Metro, which a release build does not do. |
| One inference, CPU | 572 ms median of 5 (568 to 652 ms) |
| `embedImage` on a stored 1080 px photo | 767 ms (crop and decode 161 ms + inference) |
| Scanner check | about 1.5 s: capture 0.6 to 0.8 s at 3060×4080, crop and embed 0.7 to 0.8 s |
| Same photo embedded twice | cosine 1.0000. GPU and CPU outputs agree (1.0000). |
| Two different Rowlet plush items | cosine 0.756 |

13 scanner checks against 2 Rowlet items gave these results. Front views of the right item scored 0.87 to 0.92, with a gap of 0.10 to 0.20 over the other item. Side views scored 0.61 to 0.81, often within 0.01 to 0.03 of the other item. One side view passed the threshold at 0.810 against 0.804. That was a near tie, not a confident match.

**Fixed while getting this to run**

- `ai-edge-quantizer` writes weights after the flatbuffer (the "buffer offset" format for models over 2 GB). Desktop LiteRT reads that format, but the runtime in fast-tflite does not. Every weight came up empty ("Input tensor 158 lacks data"). The export script now writes the weights back inline.
- On Android, changing `onBarcodeScanned` on `CameraView` rebuilds the camera session and aborts a `takePictureAsync` that is in progress. The handler stays bound during a photo check.

**To finish**

1. Photograph at least 30 owned items from new angles, then measure top-1 accuracy across thresholds. Record the measured rate here and set `MATCH_THRESHOLD`.
2. Consider also requiring a minimum gap between the first and second item. Similar items (two Rowlet plushes) score within 0.01 of each other from the side.
3. Matching improves when an item has photos from more angles, because each item scores by its best reference photo. "Mark as Dupe Check" predates automatic embedding and now only confirms that the item's photos are in the set. It could become "add reference angles" instead.
4. Speed: the GPU path does not work on this phone. fast-tflite does not set an interpreter thread count, so CPU inference may not be using all cores. Capturing at a smaller `pictureSize` would also shorten the 0.7 s capture.

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
