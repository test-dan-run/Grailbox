# Plan for adding scanner reference photos from a video

The document plans a new way to give the scanner reference photos of an item. The feature isn't built yet. For how the scanner works today, see [IMPLEMENTATION.md](IMPLEMENTATION.md).

## Summary

When you add an item, you first take one cover photo from the angle you like best, and then you record a short video while you turn the item. The app picks a few frames from the video that show the item from different angles, and it stores them as extra reference photos for the scanner. The frames are hidden, so they never show in the gallery, and the cover photo is still the only photo you see.

Today the scanner only has the photos that the user took by hand, and most items have one or two photos, usually from the front. The scanner scores an item by its best matching reference photo, so a scan from the side or the back scores lower than a scan from the front. A video gives the scanner several angles of the item for the cost of a few seconds of recording.

## What the user does

The user adds an item in five steps:

1. First, the user adds a cover photo in the item form, with the camera or the photo library, the same way as today.
2. Second, the user taps "Record scan angles" in the photo source sheet. Right after the user takes a cover photo, the form also asks whether they want to record now, and the user can skip it.
3. Third, the user records the item on a capture screen, which shows the scanner's corner guides and a hint to turn the item slowly and keep all of it inside the guides. Recording stops by itself after 15 seconds, and the user can stop it earlier.
4. Fourth, the capture screen shows progress while the app picks frames, e.g., "Picking angles, 6 of 15". It then shows the chosen frames in a grid, and the user can remove any frame before they tap Done.
5. Fifth, the form shows a chip next to the photos with the number of frames, e.g., "5 scan angles", and the chip opens the grid again. The app saves the frames when the user saves the item.

"Record scan angles" is disabled until the item has a cover photo, with the hint "Take a cover photo first". The app uses the cover photo to check the video frames, so the order can't change.

The first version adds the option to the item form only. In the wishlist sheet the photo is often a shelf tag or a listing screenshot, and those photos don't show the item well enough to check the frames against.

The app deletes the video after it picks the frames, and it keeps only the chosen frames. Recording a new video for an item replaces the item's old frames.

## Recording the video

The capture screen uses `CameraView` from expo-camera with `mode="video"`, and it records with `recordAsync({ mute: true, maxDuration: 15 })`. The app uses its own screen instead of `ImagePicker.launchCameraAsync` for two reasons. First, the screen can show the same corner guides as the scanner, so the frames are framed the same way as scans, and the scanner tests found that framing changed scores more than the angle did. Second, a muted recording shouldn't need microphone access, and `app.json` turns the microphone permission off for both camera plugins. The system camera that ImagePicker opens records sound on iOS, so it would need a microphone permission string.

The capture screen also has a "Choose a video" button, which opens the photo library through ImagePicker with `mediaTypes: ['videos']`. A video from the library wasn't recorded with the guides, so its frames get the same centered square crop as photos (`centerSquare`). Frames from the capture screen get `frameCrop`, the same crop the scanner uses.

The capture screen is a React Native `Modal` that `PhotoField` opens, instead of a new route. The chosen frames then stay in the form's state, so the form doesn't have to pass data between routes.

## Picking the frames

The app picks frames in five steps. The math in steps 2, 4, and 5 goes in a new file, `src/features/scanner/frames.ts`, as pure functions, so Jest can test them the same way as `similarity.ts`.

### Step 1. Sample candidate frames

The app opens the video with `createVideoPlayer` from expo-video, and it calls `generateThumbnailsAsync` with `maxWidth: 720` and one time every 0.33 s, which gives about 30 frames for a 10 s video. Each frame is a `VideoThumbnail`, which is a `SharedRef<'image'>`, and `ImageManipulator.manipulate` already accepts that type, so the frames go to the embedder with no temporary video frame files. The app has to release the player and every frame by hand.

### Step 2. Score sharpness and exposure

The model takes about 570 ms per frame on the Galaxy S24+, so the app drops poor frames before it runs the model on them. To do so without decoding each frame twice, `embedImage` in `embedder.ts` splits into two functions. `prepareImage` makes the input tensor and now also returns the 224 px RGB pixels, and a new `embedTensor` runs the model on a tensor that `prepareImage` already made.

From the pixels, `frames.ts` computes a sharpness score, which is the variance of the Laplacian of the brightness. The Laplacian is a 3 × 3 filter that responds to edges, so a blurry frame gets a low score. The file also computes the mean brightness and the share of pixels that are almost black or almost white.

The app drops frames that are too dark or too bright. It then splits the video into windows of about 0.66 s and keeps the sharpest frame in each window, which leaves about 15 frames for a 10 s video.

### Step 3. Embed the frames and the cover photo

The app embeds the remaining frames and the cover photo through the queue in `embedder.ts`, so the background reference work never runs the model at the same time. The cover photo's vector is the same vector that `references.ts` would compute, so the app stores it right away instead of computing it again later.

### Step 4. Drop frames that don't show the item

A video can include frames of a hand, the table, or the room. The app first finds the medoid, which is the frame with the highest mean cosine similarity to the other frames. It then drops a frame when the frame's similarity to the cover photo and its similarity to the medoid are both below a cutoff, which starts at 0.5.

The medoid check keeps views of the back of the item, which can look different from a cover photo of the front. In the scanner tests, side and back views of an item scored 0.79 to 0.86 against front photos of the same item, so a cutoff of 0.5 leaves a large margin.

### Step 5. Choose frames that differ from each other

The app picks the final frames with greedy farthest point sampling, in three steps:

1. First, the app treats the cover photo as already chosen.
2. Second, in each round, the app adds the frame whose highest similarity to the chosen photos is the lowest, with a small bonus for sharpness.
3. Third, the app stops after 5 frames, or earlier when every remaining frame has a similarity of at least 0.95 to a chosen photo.

The first frame the app picks is the one that looks least like the cover photo, so the app doesn't spend frames on near copies of the front view. When the item barely turned in the video, the app stops early and keeps fewer frames.

`selectFrames(candidates, { seed, max, cutoff })` returns the chosen frames, and the reason the app dropped each other frame, for the debug files.

### Time budget

On the S24+, embedding 15 frames at 570 ms each takes about 9 s. The time to make and decode the frames isn't known yet, and the spike in the first phase measures it. If the total is too slow, the app can sample fewer frames, or smaller frames.

## Storing the frames

The app stores the frames as hidden reference photos in the `item_embeddings` table, and a new `source` column says where each reference photo came from. The value is `photo` for an item photo and `video` for a video frame. Each frame is a 448 px JPEG in the `photos/` folder, with no 256 px thumbnail. The frames keep twice the model's input size, so a later model with a larger input can embed them again.

`references.ts` doesn't change. When `EMBEDDING_MODEL` changes, `pendingReferences` returns the video frames along with the item photos, and the app embeds them again from their JPEG files. The frames are already square, so the `centerSquare` crop leaves them as they are.

| File | Change |
| --- | --- |
| `src/db/schema.ts` and a new migration | Add `source text not null default 'photo'` to `item_embeddings`. |
| `src/db/repositories/embeddings.ts` | Add functions to add, list, and remove an item's frames. `syncReferencePhotos` only manages rows with `source = 'photo'`, because today it deletes every reference photo that isn't in `items.photos`. |
| `src/features/items/ItemFormScreen.tsx` | Keep the frames and their vectors in the form state, and save them after `createItem` or `updateItem` returns. |
| `src/lib/useUnsavedPhotos.ts` | Delete the frame files when the form closes without saving. |
| `src/db/repositories/items.ts` and `collections.ts` | `deleteItem` and `deleteCollection` also return the frame paths, so the screens delete the frame files. The database deletes the rows through the foreign key cascade. |
| `src/lib/exportData.ts` | Add `reference_frames` to each item in `grailbox.json`. The zip already holds the frame files, because Export writes every file in `photos/` except the thumbnails. |
| `app.json` and `package.json` | Add expo-video with `npx expo install expo-video`, and add its config plugin. The change needs a new development build. |

The frames don't depend on the cover photo after the app saves them. If the user changes the cover photo later, the frames stay, and the new cover photo becomes one more reference photo. If the user removes every photo, the frames still let the scanner find the item, and the item shows the usual placeholder in the gallery.

## Effect on matching

More reference photos per item can change the results of the match rule, so the thresholds need a new test before the feature ships. `rankItems` scores an item by its best matching reference photo. An item with 6 reference photos then has 6 chances to score high against a scan, which raises its score for real matches and also for items that look like it. Items with one photo also fall behind items with frames.

The risk is highest in the Rowlet collection, where 17 items show the same character, and where the lead of 0.10 over the next item is what prevents a wrong "Already owned". The app keeps its current preference for No match over a wrong match.

The test plan has three parts:

1. First, record videos of the Rowlet items and of a few items from other collections.
2. Second, run the replay test from IMPLEMENTATION.md again with the frames as reference photos. The test leaves out one photo, and then each whole item, and it checks the 0.70 threshold and the 0.10 lead.
3. Third, if false matches go up, try a lower cap on frames per item, or score each item by the mean of its two best reference photos instead of the best one. Change the thresholds only if neither change fixes the false matches.

## Debug tools

In development builds, the app saves every candidate frame to `files/frame-debug` on the phone, along with its sharpness, its similarities, and the reason the app kept or dropped it. Metro also logs the time for each step with the `[Frames]` prefix. To copy the files, run `adb exec-out run-as app.grailbox tar c files/frame-debug | tar x`.

## Build order

1. Spike on the S24+ and an iPhone
   - Record with `CameraView` in video mode, call `generateThumbnailsAsync` with about 30 times, and log how long it takes.
   - Confirm that `embedImage` works on a `VideoThumbnail`, and that a muted recording on iOS doesn't ask for the microphone.
   - Save the cropped frames, and check that `frameCrop` matches the guides when the camera is in video mode, because the video can have a different aspect ratio from a photo.
2. Frame selection and storage
   - Write `frames.ts` with Jest tests for sharpness on synthetic images, the medoid and the cutoff, and farthest point sampling on vectors made by hand, including a case with a cover vector, a case with duplicate frames, and a case where the item didn't turn.
   - Split `embedImage` into `prepareImage` and `embedTensor`.
   - Add the migration and the repository functions, and test them against the real SQLite database in the Jest helper.
3. Capture screen and the record lifecycle
   - Build the capture screen and the frame grid, and add them to `PhotoField` in the item form.
   - Delete frame files when the form closes without saving, and when the user deletes an item or a collection.
   - Add the frames to Export.
4. Matching test and docs
   - Run the matching test from the previous section, and change the scoring if the test needs it.
   - Add a Maestro flow. The demo build can play a bundled video in place of the camera, the same way it shows still images in the scanner.
   - Move the parts of the document that describe the built feature into IMPLEMENTATION.md.

## Open questions

- The time to make and decode 30 frames on the S24+ isn't known yet.
- It isn't confirmed that a muted `recordAsync` on iOS works without a microphone permission string.
- The sharpness and brightness limits, the 0.5 cutoff, and the cap of 5 frames are first guesses, and the debug files from the first real videos will set them.
