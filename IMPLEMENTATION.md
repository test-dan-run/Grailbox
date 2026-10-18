# Grailbox implementation

The document describes how Grailbox is built, which choices were made along the way, and what has been tested. For what the app does and how to run it, see [README.md](README.md). The design and the requirements come from `HANDOFF.md`.

## Status by milestone

| # | Milestone | Status |
| --- | --- | --- |
| 1 | Foundation | Done. Theme tokens, fonts, icon set, schema and migrations, seed data, and CI. |
| 2 | Browse | Done. Launch screen, Dashboard, Gallery, Item Details, search, and filters. |
| 3 | Capture and edit | Done. Wishlist sheet, item, collection, and journal forms, photo capture and import with 1080 px and 256 px copies, a currency per item, an artist or shop link, and Export. |
| 4 | Journal | Done. Timeline, entry screen, and entry form with photos and tagged items. |
| 5 | Scanner, phase 1 | Done. Camera, corner guides, four banner states, barcode matching, flash, haptics, and "Search instead". |
| 6 | Scanner, phase 2 | Done. The app embeds every item photo on the phone, and "Check this item" in the scanner matches by photo. The thresholds come from 24 scans of 3 items and from the reference photos of 30 items on a Galaxy S24+ (see [Accuracy](#accuracy)). |

## What has been verified

- Verified on a Galaxy S24+ with Android 16 and an EAS development build, on 2026-10-18
  - The native build, photo import, and the camera preview
  - Photo matching in the scanner (see [Photo matching](#photo-matching-phase-2))
- Verified on the development computer
  - Lint, the type check, 43 Jest tests, and Metro bundles for iOS and Android
  - `expo-doctor`, which reports one warning, "Untested on New Architecture: react-native-fast-tflite". The library is a Nitro module and runs on the New Architecture on the S24+.
  - Every screen, rendered with react-native-web at 390×844 and compared with its frame on the design canvas
- Not verified yet
  - Anything on iOS, and the Maestro flows
  - Barcode scanning, because no item with a barcode was at hand
  - Haptics and the Export share sheet
  - The performance target, which is 500 items in under 300 ms on a mid-range Android phone

To run the Maestro flows, use `npm run e2e` with a build installed on a phone. The flows also take the screenshots that each milestone asks for.

## Project layout

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
scripts/               model export script
patches/               patch-package patches, applied on every install by the postinstall script
```

Each file in `src/app/` only renders a screen from `src/features/`, so the screen code stays outside the routes folder.

## How screens read and write data

Screens read data by calling repository functions inside the `useQuery` hook. Every repository write calls `notifyChange()`, and each mounted `useQuery` then fetches its data again. There is no network layer, and every ID is a UUID string.

The Jest tests run the repositories against a real SQLite database. They also cover the money and date helpers, the wishlist sheet, and the similarity ranking that the scanner uses.

## Routes

| Route | Screen |
| --- | --- |
| `/` | 00 Launch screen, which then replaces itself with the Dashboard |
| `/dashboard` | 02 Collections Dashboard (`?search=1` focuses the search field) |
| `/wishlist/new` | 01 Spot a Wishlist Item (modal, with `?collectionId`, `?fromItem`, and `?barcode`) |
| `/scanner` | 06 Scanner and Dupe Verifier (full screen modal) |
| `/collection/:id` | 03 Collection Gallery |
| `/collection/:id/journal` | 05 Progress Journal (switching tabs replaces the route, so tabs never stack) |
| `/item/:id` | 04 Item Details and Provenance |
| `/journal/:entryId` | 05a Journal Entry |
| `/item/form`, `/collection/form`, `/journal/form` | Forms to create and edit records (modal, with `?id` to edit) |
| `/settings` | Export and sample data |

## Decisions and assumptions

The handoff asks for a record of every choice. A choice marked "(deviation)" differs from what the handoff suggested.

### Libraries

The libraries follow the handoff. The app uses Expo, expo-router, expo-sqlite with Drizzle ORM and its migrations, expo-image, Reanimated, react-native-svg, and the Plus Jakarta Sans font.

### Data model

An item's specs are stored as separate columns (`release_year`, `manufacturer`, `size`, and `barcode`) instead of one object, so the database can index the barcode. The repositories turn the columns back into a `specs` object when they read an item.

Collections have a `sort_order` column, which the Reorder action changes. The app computes collection counts and preview photos each time it reads them, and never stores them.

Duplicate copies of an item are stored as the `quantity` on one item, as the handoff decided. The Dashboard and the tally count items, not copies.

When you change an item's status to Wishlist, the app clears its condition. When you change an item from Wishlist to another status, the app clears its priority. Both rules come from the data model in the handoff.

The `item_embeddings` table is the phase 2 table that the handoff names. An embedding is a list of numbers that describes what a photo looks like, so two photos of the same item get similar lists. Every item photo gets a row, where the `vector` column holds the embedding and the `model` column names the model that made it. When the model changes, the app recomputes the old vectors instead of comparing vectors from two different models.

### Photos

(deviation) Photo paths are stored relative to the app's document directory, e.g., `photos/<uuid>.jpg`, instead of as absolute `file://` URIs. The reason is that iOS changes the app's container path between app updates, so an absolute path can stop working. Each photo also has a 256 px thumbnail next to it, with the same name ending in `_256.jpg`.

If you import photos in a form and then cancel the form, the app deletes those photos. If you remove a photo from a record, the app deletes the photo file when you save the record.

### Search

Search uses SQLite's FTS5 full text search with the `unicode61 remove_diacritics 2` tokenizer, so "pokemon" matches "Pokémon". Every word you type must match the start of a word in the item.

The FTS table stands alone and uses `item_id` as its key, instead of reading its text from the `items` table as an external content table. The reason is that `items` has a text primary key, so its hidden rowid can change when SQLite runs VACUUM, and an external content table depends on the rowid.

The web build of expo-sqlite doesn't include FTS5, so the web preview skips the search migration and searches with `LIKE` instead. The tests cover the `LIKE` path as well.

### Dashboard

(deviation) The Dashboard header has a third icon button, a gear that opens Settings. The canvas shows only the Scan and Spot buttons, but Export needed a place in the app.

The Dashboard's filter button opens status pills for Any, Owned, Wishlist, and In transit. If you choose a status and leave the search empty, the Dashboard lists every item with that status across all collections, so you can see the whole wishlist in one list. The Gallery's filter button does the same inside one collection.

The ••• menu has a Reorder action, which shows up and down buttons on each collection until you tap Done. Delete asks for confirmation, and it also removes the collection's photo files.

Each collection card ends with a line of the form "Updated Oct 2026", followed by "Latest:" and the title of the most recently acquired owned item. A collection with no items shows one sentence instead of the chips and the photo row.

### Gallery and journal

The Gallery lists items with the newest first. The seed data inserts items in reverse order, so the Gallery order matches the canvas.

"Collecting since" uses the earliest acquisition date in the collection. When no item has an acquisition date, the Journal subtitle shows the tally instead.

A Milestone entry that isn't a grail gets a white node with an outlined star. The handoff defines node styles only for the other entry types.

For a Batch addition entry, the "N new additions uploaded" line counts the tagged items, or counts the photos when no item is tagged. When an entry has no photos of its own, its collage and hero image use the cover photos of the tagged items.

### Item details

A wishlist item shows a "Wishlist details" card with the target price instead of "Acquisition history", and a "Priority" chip joins the row of chips.

(deviation) Item Details has two action tiles, Add to Wishlist and Share. The handoff also asked for "Mark as Dupe Check", which added an item's photos to the scanner's reference set. The app now adds every item photo to the reference set on its own, shortly after the item is saved, so the action was removed.

Share opens the system share sheet. On iOS it shares the photo and the title together. On Android it shares the photo file when the item has one, and shares the text otherwise.

### Prices

Prices are shown with thousands separators and with the number of decimal places that the currency uses, e.g., 0 for JPY and 3 for KWD. You always type a price with "." as the decimal point. The app displays prices with `Intl.NumberFormat`, using the phone's locale and the item's own currency.

The list of ISO 4217 currencies is bundled with the app, because the Hermes JavaScript engine doesn't support `Intl.supportedValuesOf`.

### Export

(deviation) Export creates one zip file instead of two separate files. The zip holds `grailbox.json` and a `photos/` folder, and the paths in the JSON match the paths in the zip. Thumbnails are left out, because the app can make them again from the photos.

The app writes the zip to disk one photo at a time with `fflate`, so a large collection doesn't have to fit in memory.

### Launch screen and app icon

The native splash screen, with a mint background and the capsule logo, is configured in `app.json` with a dark variant. The reveal animation plays on the first render after the splash screen.

The native splash screen puts the logo in the center, while the reveal animation ends with the logo 40 px above the center, so you may see the logo move a little. With Reduce Motion on, the app shows the last frame of the reveal for 0.7 s and then moves on.

The app icon assets were made from the "Capsule Star" SVG that was chosen on the canvas. They include the iOS icon, an Android adaptive foreground with a monochrome layer, and both splash images.

## Scanner

The scanner checks whether you already own an item, or already have it on your wishlist. It reads barcodes all the time while the camera is open, and it matches by photo when you tap "Check this item".

### Barcode matching (phase 1)

The seed data gives two items made up barcodes. To test them, print the codes with any EAN-13 generator, or show them on another screen.

| Code | Item | Expected banner |
| --- | --- | --- |
| `4521329266181` | Rowlet Jumbo Plush | Already owned, with `1 in Grailbox — Shelf B, Display Case 1` |
| `4521329311119` | Rowlet Juggling Plush | On wishlist, with priority High |
| Any other code | None | No match, with "Add to collection" and "Spot for wishlist", which both carry the scanned code |

UPC-A, EAN-13, and GTIN-14 codes differ only by leading zeros, so the app matches a numeric code across all three forms. When an owned item and a wishlist item have the same code, the owned item wins.

The app announces scan results to screen readers as alerts. Already owned plays a warning haptic, and On wishlist plays a success haptic.

### Photo matching (phase 2)

Photo matching works from start to finish on a phone. The match threshold was fitted on real photos of 30 items, although those were the items' saved photos rather than scanner photos (see [Accuracy](#accuracy)).

#### How it works

The model is DINOv2 ViT-S/14, which is Apache-2.0 licensed. It runs at 224 px with fp16 weights from `assets/models/dinov2_vits14.tflite` (44 MB), and it outputs a vector of 384 numbers for each photo. To rebuild the model file, run `uv run scripts/export_dinov2.py`, which also checks the output against PyTorch.

The app runs the model with `react-native-fast-tflite` in `src/features/scanner/embedder.ts`. It tries the GPU first and falls back to the CPU, and it runs one model call at a time from a queue.

The CPU path runs on one thread, because a collection app shouldn't use several cores for one check. fast-tflite 3.0.1 has no thread setting, so `patches/react-native-fast-tflite+3.0.1.patch` calls `TfLiteInterpreterOptionsSetNumThreads(options, 1)` when it creates the interpreter. Without the call, LiteRT already ran XNNPACK on one thread, but its Eigen kernels could start a pool of several threads. The patch was checked in an EAS development build on the S24+ on 2026-10-18 (see the measurements below).

`src/features/scanner/references.ts` keeps the reference set up to date, so every item photo has a vector. It runs at launch and shortly after any data change, and it embeds one photo at a time. It loads the model only when a photo needs a vector, and it recomputes vectors that an older `EMBEDDING_MODEL` made.

When you tap "Check this item", the scanner works in these steps:

1. It takes one photo with no shutter sound, and crops the photo to the area inside the corner guides plus 15% (`frameCrop` in `preprocess.ts`).
2. It embeds the crop, and ranks the items by the score of each item's best matching reference photo (`similarity.ts`).
3. If the top item scores at least `MATCH_THRESHOLD` (0.70) and leads the next item by at least `MATCH_MIN_GAP` (0.10), the scanner shows Already owned or On wishlist. Otherwise it shows No match with the 3 closest items, which you can tap to open.

On Android, the scanner doesn't capture at the full sensor size. The first time the camera opens in each app run, the scanner asks the camera for its supported sizes, and picks the smallest 4:3 size with a short side of at least 1080 px (`smallestPictureSize` in `preprocess.ts`). On the S24+, a 1080 × 1440 photo still gives a crop of about 540 px, which is more than twice the model's input. iOS keeps the default size.

In development builds, the match pill shows the raw score, and Metro logs the timing and the top scores of every check with the `[Scanner]` prefix. The app also saves each check's photo, crop, and scores to `files/scan-debug` on the phone, so you can tune the matching on a computer. To copy the files, run `adb exec-out run-as app.grailbox tar c files/scan-debug | tar x`.

#### Measurements

The measurements below were taken on a Samsung Galaxy S24+ (SM-S926B, Exynos 2400, Android 16) with a development build, on 2026-10-18.

| Step | Result |
| --- | --- |
| GPU delegate (`android-gpu`, OpenCL) | Fails, and the app falls back to the CPU. The delegate accepts 40 of 721 ops, because it doesn't support BROADCAST_TO, DEQUANTIZE, and a MUL with mismatched ranks. It then fails to prepare on a 1×1×384 CONCATENATION. |
| Model load | 1.5 s on the CPU, or 2.6 s including the failed GPU attempt. Both times include fetching 44 MB from Metro, which a release build doesn't do. |
| One inference on the CPU | 572 ms, the median of 5 runs (568 to 652 ms) |
| One inference with the one thread patch | 569 to 570 ms, the median of 5 runs, against 572 to 573 ms on the old build on the same day. Both builds used one core at about 100% during inference, out of 10. The embeddings were the same to 4 decimal places. |
| `embedImage` on a stored 1080 px photo | 767 ms, which is 161 ms to crop and decode plus the inference |
| One scanner check, full size capture | About 1.5 s. The capture at 3060×4080 takes 0.6 to 0.8 s, and the crop and embedding take 0.7 to 0.8 s. |
| One scanner check, smaller capture | About 1.2 s. The capture at 1080×1440 takes 0.41 to 0.50 s, and the crop and embedding take 0.71 to 0.76 s (7 scans). Maneki-Rowlet scored 0.867 to 0.889, the same as at full size. |
| The same photo embedded twice | Cosine similarity of 1.0000. The GPU and CPU outputs also agree at 1.0000. |
| Two different Rowlet plush items | Cosine similarity of 0.756 |

#### Accuracy

The thresholds come from two tests on the same phone. The first used 24 scanner photos of 3 items, and the second replayed the saved photos of 30 items.

##### Scanner photos of 3 items

The test used 3 items and 24 labelled scans on the same phone. The items were Maneki-Rowlet with 6 reference photos, Chicken Rowlet with 4, and an Ichiban Kuji Rowlet with 1. There were 20 scans of these items from the front, the sides, the back, and further away. There were also 4 scans of things that aren't in Grailbox, which were a Rowlet mug (twice), a small Rowlet item held in the hand, and headphones.

The right item ranked first in all 20 scans of real items.

Framing affected the score more than the angle did. With the item inside the guides, side and back views scored 0.79 to 0.86, close to the front views at 0.85 to 0.88. When the item spilled outside the guides, the crop held only part of the item and scores fell to about 0.6, so the hint now asks you to fit the whole item inside the frame.

The main risk is items that look alike, rather than low scores. For example, the small hand-held Rowlet item scored 0.814 against a Rowlet plush, but only 0.067 ahead of a second Rowlet item. Every real match led the next item by 0.12 or more.

Two matching rules were replayed on the 24 scans, and the app used the second one until the 30 item test.

| Rule | Correct matches (of 20) | False matches |
| --- | --- | --- |
| Score ≥ 0.80 | 9 | 1 (the hand-held Rowlet item) |
| Score ≥ 0.65 and a lead of ≥ 0.10 | 15 | 0 |

Other crops were also tested on the same scans, e.g., a larger crop, the full width of the photo, and padding the reference photos to a square instead of cropping their centers. None of them did better than the current crop.

##### Saved photos of 30 items

The second test used the 74 saved photos of 30 items in 4 collections, which were Rowlet (17 items), Hoshimachi Suisei (9), Maplestory (3) and DH Monkey (1). The embeddings were copied from the phone's database and replayed on a computer, in two ways:

1. For a known item, each photo of an item with 2 or more photos was used as the scan, with that photo left out of the references. There were 67 such scans from 23 items.
2. For an item that isn't in the collection, each item's photos were used as scans, with all of that item's photos left out. There were 74 such scans.

The right item ranked first in 60 of the 67 known item scans. No rule with a lead of at least 0.05 matched a known item to the wrong item.

| Rule | Known item matched (of 67) | False matches (of 74) |
| --- | --- | --- |
| Score ≥ 0.65 and a lead of ≥ 0.10 | 43 | 2 |
| Score ≥ 0.70 and a lead of ≥ 0.08 | 43 | 0 |
| Score ≥ 0.70 and a lead of ≥ 0.10 (the app's rule) | 40 | 0 |

The 2 false matches under the old rule were RE-MENT Garden Series #1, which scored 0.681 against RE-MENT Happiness Wreath, and Pink Bean on Rock Spirit Keychain, which scored 0.676 against Clay Doll Suisei. Both led the next item by more than 0.10, so the threshold rose to 0.70.

The lead stays at 0.10, although 0.08 scored better on the saved photos. In a scanner test of 4 Rowlet items that aren't in the collection, one scored 0.831 and led the next item by 0.089, so a lead of 0.08 would have shown it as Already owned.

Most of the known item scans with no match come from the Rowlet collection, where 17 items show the same character and the right item often leads the next one by less than 0.08. In those cases the scanner shows No match and lists the right item among the 3 closest items. The 7 items with only one photo couldn't be tested as known items.

The saved photos aren't scanner photos. The scanner crops to the corner guides, and photos of one item taken in one session can look more alike than a scan does. A scanner test of all 30 items wasn't run, by decision.

#### Problems fixed while getting the model to run

The model file had no usable weights at first. `ai-edge-quantizer` writes the weights after the flatbuffer, in the "buffer offset" format meant for models over 2 GB. Desktop LiteRT reads that format, but the runtime inside fast-tflite doesn't, so every weight came up empty with the error "Input tensor 158 lacks data". The export script now writes the weights back inline.

On Android, changing `onBarcodeScanned` on `CameraView` rebuilds the camera session, which cancels any `takePictureAsync` call in progress. The scanner now keeps the barcode handler bound during a photo check.

On Android, expo-camera's `PictureRef.savePictureAsync` computes the JPEG quality as `quality.toInt() * 100`, so any quality below 1 saves at quality 0. Only the debug copies use `savePictureAsync`, with `quality: 1`, and the scanner embeds the picture from memory.

#### Remaining work

Nothing is left for phase 2.

## Accessibility

- Controls and labels
  - Every control is a real button or link with a label. Icon buttons have names, e.g., "Scan an item for duplicates".
  - Segmented controls are tab lists with a selected state, and filter pills report whether they're selected.
  - Status chips always show their word, so the status doesn't depend on color alone.
- Layout and text
  - Touch targets are at least 44 × 44, with extra hit area where the drawn control is smaller.
  - Text scales with the system text size. Long titles wrap, and maker lines are cut off with an ellipsis.
  - The `text-muted` color is used only for placeholders and disabled text.
  - Every screen respects the safe areas on all edges, and there is no fake status bar.
- Motion
  - With Reduce Motion on, the app skips the launch reveal, the scanner sweep, and the progress bar animation.

## Web preview setup

The web preview (`npx expo start --web`) is only for design review. The web worker in expo-sqlite needs WebAssembly and SharedArrayBuffer, so `metro.config.js` adds WebAssembly support and the COOP and COEP headers.

In the current setup, the dev server didn't add those headers to the HTML page itself, so the screenshot harness added them. Headless Chrome also needed expo-sqlite's longer sync wait, with `Atomics.pause` removed.
