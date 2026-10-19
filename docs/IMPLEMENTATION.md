# Grailbox implementation

The document explains how Grailbox is built and why it's built that way. For what the app does and how to run it, see [README.md](../README.md).

## Design goals

Grailbox is an offline app for one person, and most of the design follows from that. The app has no accounts, no server, and no network calls, so every piece of data stays on the phone. The database is SQLite, and the photos are files in the app's document directory. The photo matcher also runs on the phone, with a machine learning model that ships inside the app.

Export is the only way to get data off the phone. It writes one zip file, and you save it wherever you want, so the app never needs a backup service of its own.

## Code layout

```
src/
  app/                 expo-router routes, each of which renders one feature screen
  db/                  schema.ts, database.ts, client.ts, repositories/, seed.ts, useQuery.ts
  features/            collections/ items/ wishlist/ journal/ scanner/ settings/ launch/ demo/
  components/          ui.tsx (buttons, chips, segmented control, photo tile), form.tsx, Sheet.tsx, Icons.tsx
  lib/                 money, currencies, dates, photos, export, navigation helpers
  theme.ts             every design token from the design canvas
drizzle/               generated SQL migrations
.maestro/              end-to-end flows
scripts/               the model export script
patches/               patch-package patches, applied on every install by the postinstall script
video/                 the showcase video project (see video/README.md)
docs/                  the document, and the instructions for coding agents
```

Each file in `src/app/` only renders a screen from `src/features/`. The routes folder then holds only routes, and each screen sits next to the rest of its feature's code.

### Routes

| Route | Screen |
| --- | --- |
| `/` | Launch screen, which then replaces itself with the Dashboard |
| `/dashboard` | Collections Dashboard (`?search=1` focuses the search field) |
| `/wishlist/new` | Spot a Wishlist Item (modal, with `?collectionId`, `?fromItem`, and `?barcode`) |
| `/scanner` | Scanner (full screen modal) |
| `/collection/:id` | Collection Gallery |
| `/collection/:id/journal` | Progress Journal |
| `/item/:id` | Item Details |
| `/journal/:entryId` | Journal Entry |
| `/item/form`, `/collection/form`, `/journal/form` | Forms to create and edit records (modal, with `?id` to edit) |
| `/settings` | Export, and the sample data in development builds |

Switching between the Gallery and Journal tabs replaces the route instead of pushing a new one, so the back button never walks through old tabs.

## Data

### How screens read and write data

Screens read data by calling repository functions inside the `useQuery` hook. Every repository write calls `notifyChange()`, and each mounted `useQuery` hook then reads its data again. The app keeps no copy of the data in memory, so SQLite is the only place where data lives, and a screen can't show data that is out of date after a write.

Every ID is a UUID string. The Jest tests run the repositories against a real SQLite database instead of a mock, so they also test the SQL.

### Data model

An item's specs are stored as separate columns (`release_year`, `manufacturer`, `size`, and `barcode`) instead of one object, so the database can index the barcode for the scanner. The repositories turn the columns back into a `specs` object when they read an item.

The app computes collection counts and preview photos each time it reads them, and never stores them, so they can't get out of step with the items. Collections have a `sort_order` column, which the Reorder action changes.

Duplicate copies of an item are stored as the `quantity` of one item, instead of as separate items. The Dashboard and the collection tally count items, not copies.

An item's status decides which of its fields apply. When you change an item to Wishlist, the app clears its condition, because you don't own it yet. When you change an item from Wishlist to another status, the app clears its priority.

The `item_embeddings` table holds one row for every reference photo, for the photo matcher. An embedding is a list of numbers that describes what a photo looks like, so two photos of the same item get similar lists. The `vector` column holds the embedding, and the `model` column names the model that made it. Vectors from two different models can't be compared, so when the model changes, the app computes the old vectors again.

A reference photo is either an item photo or a frame from the item's scan angles video, and the `source` column says which, with `photo` or `video`. Every item photo is a reference photo. Video frames are hidden, so they never show in the gallery, and they live only in `item_embeddings`, not in the item's `photos` list. For how the app picks the frames, see [Scan angles](#scan-angles).

### Photos

Photo paths are stored relative to the app's document directory, e.g., `photos/<uuid>.jpg`, instead of as absolute `file://` URIs. iOS changes the app's container path between app updates, so an absolute path could stop working after an update.

The app saves every photo at two sizes. The main copy is 1080 px, and a 256 px thumbnail sits next to it with a name ending in `_256.jpg`, so lists and grids don't decode full size photos. Scan angle frames are square 448 px JPEGs in the same folder, with no thumbnail, because no list shows them.

If you import photos in a form and then cancel the form, the app deletes those photos. If you remove a photo from a record, the app deletes the photo file when you save the record. The app also deletes photos that you import and then remove again before you save, e.g., the frames of a scan angles video that you record again. The rules keep photo files from piling up without a record that uses them. When you delete an item or a collection, the app deletes the files of its photos and of its scan angle frames.

### Search

Search uses SQLite's FTS5 full text search with the `unicode61 remove_diacritics 2` tokenizer, so "pokemon" matches "Pokémon". Every word you type must match the start of a word in the item.

The FTS table stands alone and uses `item_id` as its key, instead of reading its text from the `items` table as an external content table. An external content table depends on SQLite's hidden rowid, and the rowid of a table with a text primary key, like `items`, can change when SQLite runs VACUUM.

The web build of expo-sqlite doesn't include FTS5, so the web preview skips the search migration and searches with `LIKE` instead. The tests cover the `LIKE` path as well.

### Prices

Each item has its own currency. Prices are shown with `Intl.NumberFormat`, using the phone's locale and the item's currency, so they get thousands separators and the right number of decimal places, e.g., 0 for JPY and 3 for KWD. You always type a price with "." as the decimal point.

The list of ISO 4217 currencies is bundled with the app, because the Hermes JavaScript engine doesn't support `Intl.supportedValuesOf`.

### Export

Export creates one zip file, which holds `grailbox.json` and a `photos/` folder, and the paths in the JSON match the paths in the zip. One file is easier to save and move than the data and the photos as two separate files. Thumbnails are left out, because the app can make them again from the photos. Each item in the JSON lists its scan angle frames in `reference_frames`, and the frame files are in the same `photos/` folder.

The app writes the zip one photo at a time with `fflate`, so a large collection doesn't have to fit in memory.

## Screens

### Dashboard

The Dashboard header has a gear button that opens Settings. The design canvas shows only the Scan and Spot buttons, but Export needed a place in the app.

Settings also has a "Load sample data" button, which adds the 3 collections, 8 Rowlet items, and 3 journal entries from the design canvas. The button only shows in development builds and in the demo build, because the sample data is for testing, and the Maestro flows and the demo video load it.

The Dashboard's filter button shows status pills for Any, Owned, Wishlist, and In transit. If you choose a status and leave the search empty, the Dashboard lists every item with that status across all collections, so you can see the whole wishlist in one list. The Gallery's filter button does the same inside one collection.

The ••• menu has a Reorder action, which shows up and down buttons on each collection until you tap Done. Delete asks for confirmation, and it also removes the collection's photo files.

### Gallery and journal

The Gallery lists items with the newest first. The seed data inserts items in reverse order, so the Gallery shows them in the same order as the design canvas.

"Collecting since" uses the earliest acquisition date in the collection. When no item has an acquisition date, the Journal subtitle shows the tally instead.

For a Batch addition entry, the "N new additions uploaded" line counts the tagged items, or counts the photos when no item is tagged. When an entry has no photos of its own, its collage and hero image use the cover photos of the tagged items. A Milestone entry that isn't a grail gets a white node with an outlined star, because the design only defines node styles for the other entry types.

### Item details

A wishlist item shows a "Wishlist details" card with the target price instead of "Acquisition history", and a "Priority" chip joins the row of chips.

Item Details has two action tiles, Add to Wishlist and Share. The design also had a "Mark as Dupe Check" tile, which added an item's photos to the scanner's reference photos. The app now adds every item photo to the reference photos by itself, shortly after you save the item, so the tile was removed.

Share opens the system share sheet. On iOS it shares the photo and the title together. On Android it shares the photo file when the item has one, and shares the text otherwise.

### Launch screen and app icon

The native splash screen, with a mint background and the capsule logo, is configured in `app.json` with a dark variant. The reveal animation plays on the first render after the splash screen. The native splash screen centers the logo, while the reveal animation ends with the logo 40 px above the center, so you may see the logo move a little. With Reduce Motion on, the app shows the last frame of the reveal for 0.7 s and then moves on.

The app icon assets were made from the "Capsule Star" SVG that was chosen on the design canvas. They include the iOS icon, an Android adaptive foreground with a monochrome layer, and both splash images.

## Scanner

The scanner checks whether you already own an item, or already have it on your wishlist. It reads barcodes the whole time the camera is open, and it matches by photo when you tap "Check this item".

### Barcode matching

UPC-A, EAN-13, and GTIN-14 codes differ only by leading zeros, so the app matches a numeric code across all three forms. When an owned item and a wishlist item have the same code, the owned item wins.

The app announces scan results to screen readers as alerts. Already owned plays a warning haptic, and On wishlist plays a success haptic.

In development builds, the sample data gives two items made up EAN-13 barcodes, so you can test both banners. The Rowlet Jumbo Plush, which you own, has `4521329266181`, and the Rowlet Juggling Plush, which is on the wishlist, has `4521329311119`.

### Photo matching

#### The model

The model is DINOv2 ViT-S/14, which is Apache-2.0 licensed, so the app can include it. It runs on a 224 px image with fp16 weights from `assets/models/dinov2_vits14.tflite` (44 MB), and it outputs a vector of 384 numbers for each photo. To rebuild the model file, run `uv run scripts/export_dinov2.py`, which also checks the output against PyTorch.

The app runs the model with `react-native-fast-tflite` in `src/features/scanner/embedder.ts`. It tries the GPU first (the GPU delegate on Android, and Core ML on iOS), and falls back to the CPU. On a Galaxy S24+, the GPU delegate fails, because it doesn't support several of the model's ops, so the model runs on the CPU in about 570 ms per photo.

The CPU path runs on one thread, because a collection app shouldn't take several cores for one check. fast-tflite 3.0.1 has no thread setting, so `patches/react-native-fast-tflite+3.0.1.patch` calls `TfLiteInterpreterOptionsSetNumThreads(options, 1)` when it creates the interpreter. Without the patch, LiteRT's Eigen kernels could start a pool of several threads. On the S24+, the patch didn't change the speed, and the embeddings stayed the same to 4 decimal places.

The app runs one model call at a time from a queue, so the scanner and the background reference work never run the model at the same time. Each vector records the name of the model that made it, and `EMBEDDING_MODEL` holds the current model's name. A new model file then only needs a new name there, and the app recomputes the old vectors.

#### Reference photos

`src/features/scanner/references.ts` keeps a vector for every reference photo, which means every item photo and every scan angle frame. It runs at launch and shortly after any data change, and it embeds one photo at a time in the background. It loads the model only when a photo needs a vector, so the app doesn't spend time loading the model when no photo needs a vector.

#### Scan angles

Scan angles give the scanner views of an item from the sides and the back. Most items have one or two photos, usually from the front, and the scanner scores an item by its best matching reference photo, so a scan from the side scores lower than a scan from the front. With scan angles, the user records a short video while they turn the item, and the app keeps a few frames from different angles as hidden reference photos.

The user adds scan angles in the item form in four steps:

1. First, the user adds a cover photo. The photo source sheet has a "Record scan angles" action, which stays disabled until the item has a cover photo, because the app checks the video frames against the cover photo. Right after the user adds the first photo of an item that isn't on the wishlist, the form also asks whether they want to record now.
2. Second, the user records the item on the capture screen in `src/features/items/ScanAnglesModal.tsx`, which shows the scanner's corner guides. Recording stops by itself after 10 seconds, and the app asks for a longer video when a recording is shorter than 2 seconds. The user can also choose a video from the photo library.
3. Third, the capture screen shows progress while the app picks frames, and it then shows the chosen frames in a grid, where the user can remove any frame.
4. Fourth, the form shows a chip with the number of frames, e.g., "5 scan angles", and the chip opens the grid again. The app saves the frames when the user saves the item.

A new recording replaces the item's frames, and the app deletes the video after it picks the frames. The wishlist sheet has no scan angles, because its photo is often a shelf tag or a listing screenshot, which doesn't show the item well enough to check the frames against.

The capture screen records with `CameraView` in video mode, with the `mute` prop set. On Android, a muted recording doesn't need the microphone permission, which the app's manifest leaves out. The capture screen is a React Native `Modal` that the item form opens, instead of a route, so the frames stay in the form's state.

The app picks the frames in five steps. The math is in `src/features/scanner/frames.ts` as pure functions with Jest tests, and `videoFrames.ts` does the native parts.

1. First, the app samples up to 16 frames, spread evenly over the video and at least 0.33 s apart, with expo-video's `generateThumbnailsAsync`, at 720 px wide. It crops each frame to the area inside the guides with `frameCrop`, the same crop the scanner uses, and it saves the crop as a 448 px JPEG. Frames from a library video get the centered square crop, because nobody framed them with the guides.
2. Second, the app scores the sharpness and the exposure of each frame from its 224 px pixels. The sharpness is the variance of the Laplacian of the brightness, where the Laplacian is a 3 × 3 filter that responds to edges, so a blurry frame gets a low score. The app drops frames that are too dark or too bright, keeps the sharper frame of each pair of neighboring frames, and drops frames with less than 35% of the median sharpness.
3. Third, the app embeds the remaining frames, which are at most 8. It embeds the cover photo while it reads the video, because reading doesn't use the model.
4. Fourth, the app drops a frame when its cosine similarity to the cover photo and its similarity to the medoid are both below 0.5. The medoid is the frame with the highest mean similarity to the other frames, and the medoid check keeps views of the back, which can look different from a cover photo of the front.
5. Fifth, the app picks up to 5 frames with greedy farthest point sampling. It treats the cover photo as already chosen, and in each round it adds the frame that is least similar to its most similar chosen photo, with a small bonus for sharpness. It skips frames with a similarity of 0.95 or more to a chosen photo, so a video of an item that barely turned gives fewer frames.

The limits in `frames.ts` are first guesses, and the debug files from real videos will set them. The app stores each chosen frame with its vector, so `references.ts` doesn't embed the frame again. The app also stores the vector it computed for the cover photo. When `EMBEDDING_MODEL` changes, `references.ts` embeds the frames again from their JPEG files, the same way as item photos.

#### A check, step by step

When you tap "Check this item", the scanner works in these steps:

1. It takes one photo with no shutter sound, and crops the photo to the area inside the corner guides plus 15% (`frameCrop` in `preprocess.ts`).
2. It embeds the crop, and ranks the items by the score of each item's best matching reference photo (`similarity.ts`).
3. If the top item scores at least `MATCH_THRESHOLD` (0.70) and leads the next item by at least `MATCH_MIN_GAP` (0.10), the scanner shows Already owned or On wishlist. Otherwise, it shows No match with the 3 closest items, which you can tap to open.

The crop uses only what's inside the guides, so the background around the item doesn't change the score. Larger crops, the full width of the photo, and reference photos padded to a square instead of cropped to their center all did worse in testing.

On Android, the scanner doesn't capture at the full sensor size, because the model only sees 224 px. The first time the camera opens in each app run, the scanner asks for the camera's supported sizes, and picks the smallest 4:3 size with a short side of at least 1080 px (`smallestPictureSize` in `preprocess.ts`). On the S24+, the change cut a check from about 1.5 s to about 1.2 s with the same scores, and the 1080 × 1440 photo still gives a crop of about 540 px. iOS keeps the default size.

#### Match thresholds

A match needs both a high score and a lead over the next item, because the main risk is items that look alike, rather than low scores. A collection often holds many items of the same character. For example, in the first test below, a small Rowlet item that isn't in Grailbox scored 0.814 against a Rowlet plush, but led a second Rowlet item by only 0.067. Every real match led the next item by 0.12 or more.

The thresholds come from two tests on a Galaxy S24+. The first test used 24 scanner photos of 3 items. 20 scans showed the items from the front, the sides, the back, and further away, and 4 scans showed things that aren't in Grailbox. The right item ranked first in all 20 scans of real items, and side and back views scored 0.79 to 0.86, close to the front views at 0.85 to 0.88.

| Rule | Correct matches (of 20) | False matches |
| --- | --- | --- |
| Score ≥ 0.80 | 9 | 1 |
| Score ≥ 0.65 and a lead of ≥ 0.10 | 15 | 0 |

Framing changed the score more than the angle did. When the item spilled outside the guides, the crop held only part of the item, and scores fell to about 0.6, so the scanner's hint asks you to fit the whole item inside the frame.

The second test replayed the 74 saved photos of 30 items on a computer, with the embeddings copied from the phone. For known items, each photo of an item with 2 or more photos served as the scan, with that photo left out of the references, which gave 67 scans. For items that aren't in the collection, each item's photos served as scans, with all of that item's photos left out, which gave 74 scans.

| Rule | Known items matched (of 67) | False matches (of 74) |
| --- | --- | --- |
| Score ≥ 0.65 and a lead of ≥ 0.10 | 43 | 2 |
| Score ≥ 0.70 and a lead of ≥ 0.08 | 43 | 0 |
| Score ≥ 0.70 and a lead of ≥ 0.10 (the app's rule) | 40 | 0 |

Both false matches under the 0.65 rule scored between 0.65 and 0.70, so the threshold rose to 0.70. The lead stayed at 0.10, although 0.08 did better on the saved photos. In a scanner test of 4 Rowlet items that aren't in the collection, one scored 0.831 and led the next item by 0.089, so a lead of 0.08 would have shown it as Already owned.

The rule prefers No match over a wrong match, because a wrong Already owned could stop you from buying an item you want. Most of the known items with no match are in the Rowlet collection, where 17 items show the same character. When a Rowlet item gets No match, the scanner still lists the right item among the 3 closest items.

The saved photos aren't scanner photos, because the scanner crops to the guides, and photos taken in one session can look more alike than a scan does. A scanner test of all 30 items wasn't run.

The tests above ran before scan angles existed, when items had 1 to 3 reference photos. An item with scan angles has up to 6 reference photos, so it has more chances to score high against a scan, both for a real match and for an item that looks like it. The thresholds need a new test with scan angles, which [VIDEO_REFERENCES_PLAN.md](VIDEO_REFERENCES_PLAN.md) describes.

#### Tools for tuning in development builds

In development builds, the match pill shows the raw score, and Metro logs the timing and the top scores of every check with the `[Scanner]` prefix. The app also saves each check's photo, crop, and scores to `files/scan-debug` on the phone, so you can tune the matching on a computer. To copy the files, run `adb exec-out run-as app.grailbox tar c files/scan-debug | tar x`.

For scan angles, development builds save every sampled frame of each video to a folder in `files/frame-debug`, with a `frames.json` file. The file lists each frame's time, sharpness, brightness, and similarities to the cover photo and the medoid, and the reason the app kept or dropped the frame. The folder also holds `full.jpg`, the first frame before cropping, and `frames.json` gives its size and the crop it got, so you can check that the crop matches the guides. Metro logs the time for each video with the `[Frames]` prefix. To copy the files, run `adb exec-out run-as app.grailbox tar c files/frame-debug | tar x`.

### Platform problems the scanner code works around

- Model weights
  - `ai-edge-quantizer` writes the weights after the flatbuffer, in a format meant for models over 2 GB, which the runtime inside fast-tflite can't read. The export script writes the weights back inline.
- Bundled files in Android release builds
  - Android release builds keep bundled files as app resources, which have no file path. `embedder.ts` copies the model to the cache with expo-asset before it loads the model.
- expo-video on Android
  - `generateThumbnailsAsync` decodes every frame it's asked for at the same time, and a 720 × 1280 frame takes 3.7 MB, so `videoFrames.ts` asks for 6 frames at a time.
  - One frame that fails to decode fails the whole call, so the app then asks for the frames one at a time and skips the frame that fails.
- expo-camera on Android
  - `mute` is a `CameraView` prop, not a `recordAsync` option. In video mode, `CameraView` doesn't read barcodes.
  - Changing `onBarcodeScanned` on `CameraView` rebuilds the camera session, which cancels a photo in progress, so the scanner keeps the barcode handler bound during a photo check.
  - `PictureRef.savePictureAsync` computes the JPEG quality as `quality.toInt() * 100`, so any quality below 1 saves at quality 0. The scanner embeds the photo from memory, and only the debug copies use `savePictureAsync`, with `quality: 1`.

## Demo build

The demo build records the showcase video on an Android emulator, which has no camera to point at an item. It's a release build with `EXPO_PUBLIC_DEMO=1` set, and the code is in `src/features/demo/`. Expo writes the flag's value into the JavaScript bundle at build time, so a store build can't turn the demo behavior on.

The demo build changes two things. The scanner shows still images in place of the camera, and "Check this item" runs the real photo matcher on them. "Load sample data" also gives each sample item a product photo, so the matcher has reference photos, and it leaves out the sample barcodes.

The demo images are real product photos, so they aren't in git, and the demo build is for internal showcases only. `metro.config.js` gives other builds an empty stand-in for `src/features/demo/assets.ts`, so those builds don't need the images. For how to make the images and the video, see [video/README.md](../video/README.md).

## Accessibility

- Controls and labels
  - Every control is a real button or link with a label. Icon buttons have names, e.g., "Scan an item for duplicates".
  - Segmented controls are tab lists with a selected state, and filter pills report whether they're selected.
  - Status chips always show their word, so the status doesn't depend on color alone.
- Layout and text
  - Touch targets are at least 44 × 44, with extra hit area where the drawn control is smaller.
  - Text scales with the system text size. Long titles wrap, and maker lines end with an ellipsis.
  - The `text-muted` color is only for placeholders and disabled text.
  - Every screen respects the safe areas on all edges, and there is no fake status bar.
- Motion
  - With Reduce Motion on, the app skips the launch reveal, the scanner sweep, and the progress bar animation.

## Web preview

The web preview (`npx expo start --web`) is only for design review. The web worker in expo-sqlite needs WebAssembly and SharedArrayBuffer, so `metro.config.js` adds WebAssembly support and the COOP and COEP headers.
