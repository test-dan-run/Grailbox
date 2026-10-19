# Plan for adding scanner reference photos from a video

The document tracks the scan angles feature, which gives the scanner extra reference photos of an item from a short video. The feature is built for Android, and [IMPLEMENTATION.md](IMPLEMENTATION.md#scan-angles) describes how it works. The document now lists only what differs from the first plan and the work that remains.

## Summary

When you add an item, you first take one cover photo from the angle you like best, and then you record a short video while you turn the item. The app picks a few frames from the video that show the item from different angles, and it stores them as hidden reference photos for the scanner. The cover photo is still the only photo you see.

## Changes from the first plan

The build follows the plan, with these changes:

- Recording
  - `mute` is a `CameraView` prop, not a `recordAsync` option.
  - The app asks for a longer video when a recording is shorter than 2 seconds.
  - The form offers to record right after the first photo only for items that aren't on the wishlist, because the user may not have a wishlist item in hand. "Record scan angles" is still in the photo source sheet for every item.
- Picking frames
  - The app asks expo-video for 6 frames at a time, because Android decodes every requested frame at the same time.
  - Besides keeping the sharper frame of each pair, the app drops frames with less than 35% of the median sharpness.
- Files
  - `useUnsavedPhotos` now also deletes photos that a form imported and then removed again before saving. Without the change, the frames of a replaced recording would stay on the phone with no record that uses them. The same change fixes the same leak for photos in every form.
  - The scanner's corner guides moved to `src/features/scanner/Guides.tsx`, so the capture screen shows the same guides.

## Remaining work

- Test on the Galaxy S24+
  - Measure the time to read and embed the frames of a 10 s video. With 30 frames, a 10 s video took 14.1 s to read the frames and 9.5 s to embed 16 photos on the S24+, so the app now reads at most 16 frames and embeds at most 8, plus the cover photo while it reads. The new times aren't measured yet.
  - Check `full.jpg` in `files/frame-debug` against what was inside the guides. The video has a different aspect ratio from the preview, and video stabilization can crop the picture. On the emulator, the frames were upright and at the right scale, but they were shifted to the right of the guides. The emulator's virtual camera can't confirm the crop, because its photos are blank, and its video and preview may not line up the way a phone camera's do.
  - Set the sharpness and brightness limits, the 0.5 cutoff, and the cap of 5 frames from the debug files of real videos.
  - Find out whether decoding the video frames or preparing them takes longer. Development builds log both with the `[Frames]` prefix.
- Test the match thresholds with scan angles
  1. First, record videos of the Rowlet items and of a few items from other collections.
  2. Second, run the replay test from IMPLEMENTATION.md again with the frames as reference photos. The test leaves out one photo, and then each whole item, and it checks the 0.70 threshold and the 0.10 lead.
  3. Third, if false matches go up, try a lower cap on frames per item, or score each item by the mean of its two best reference photos instead of the best one. Change the thresholds only if neither change fixes the false matches.
- Add a Maestro flow for scan angles. The demo build can play a bundled video in place of the camera, the same way it shows still images in the scanner.
- iOS is untested. It isn't known whether a muted recording on iOS works without a microphone permission string.
