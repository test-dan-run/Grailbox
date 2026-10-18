# Store video

This folder makes the Google Play preview video. A Maestro flow drives the app on an Android emulator and records clips of each feature, and Remotion puts the clips together with captions and an end card. One command, `npm run video`, does both steps and writes `out/promo.mp4`.

The video is 1080 × 1920 at 30 fps. Google Play only plays a YouTube link, so you upload the file to YouTube yourself and paste the link into Play Console.

## Before you start

You need these tools:

- Node, and `npm install` run in this folder.
- The Android SDK with `adb` and an emulator. The Pixel 2 hardware profile is the best fit, because its 1080 × 1920 screen has the same shape as the video. On Linux, the emulator needs access to `/dev/kvm`.
- [Maestro](https://docs.maestro.dev/getting-started/installing-maestro).
- On Linux and WSL, the NSS libraries for Remotion's headless Chrome, with `sudo apt-get install libnss3`.

## Make the video

First, build the demo version of the app and install it on the emulator. The demo build is a normal release build with `EXPO_PUBLIC_DEMO=1` set, and the next section explains what that flag changes. You can build it in the cloud and install the APK:

```sh
npx eas-cli@latest build --profile demo --platform android
adb install path/to/the-downloaded.apk
```

Or you can build it locally from the repository root:

```sh
EXPO_PUBLIC_DEMO=1 npx expo run:android --variant release
```

Second, start the emulator and run `npm run video` in this folder. The capture step clears the app's data, loads the sample data, records six clips into `public/clips/`, and then renders `out/promo.mp4`. During the recording, Android's demo mode shows a fixed clock and a full battery in the status bar.

Third, upload `out/promo.mp4` to YouTube. Google Play requires the video to be public or unlisted, with monetization turned off and no age restriction. Paste the `youtube.com/watch?v=` link into the store listing in Play Console.

## How the demo build works

The emulator has no real camera, so the demo build changes two things in the app. The code is in `src/features/demo/demo.ts`, and store builds never set the flag.

- The scanner shows still images from `assets/demo/` in place of the camera. The first image is a barcode, which the scanner reads after a moment as if the camera saw it. "Scan Again" switches to a photo of an item, and "Check this item" runs the real photo matcher on it.
- "Load sample data" also gives two sample items photos from `assets/demo/`. The photo matcher needs item photos to compare with, and the gallery would otherwise show only placeholders.

## Change the video

The captions, the scene order, and the timing are in `src/scenes.ts`. You can trim the start or end of a clip, speed a clip up, or hold its last frame for longer. Run `npm run studio` to preview the video in a browser as you edit. If you have no device at hand, `npm run clips:sample` makes stand-in clips so that you can still work on the layout.

Google Play autoplays the first 30 seconds of the video without sound, so the captions need to tell the story. Its rules also forbid calls to action like "Download now" and claims like "#1", "Best", or "Free" in the video.

To add music, put a file at `public/music.mp3`. Use a royalty-free track, because copyrighted music can get a YouTube Content ID claim, which puts ads on the video, and Google Play doesn't allow a preview video with ads.

## Replace the placeholder photos

The images in `assets/demo/` are drawn placeholders, which `npm run demo-assets` renders. Replace them with real photos with the same file names, and don't run `npm run demo-assets` after that, because it overwrites them.

- `jumbo-plush.jpg` and `juggling-plush.jpg` are the item photos. A square photo works best.
- `scan-barcode.jpg` and `scan-photo.jpg` are what the scanner "sees". Each one should be a 1080 × 1920 portrait photo with the subject in the middle, inside a square about 680 px wide, because that is where the scanner's guides sit on a 1080 × 1920 screen.

The photo scene has to match the juggling plush and no other item, so check that the 02-photo clip ends on "ON WISHLIST" after you change either photo. If the match fails, the capture step stops with an error.
