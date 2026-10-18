# Store video

This folder makes a showcase video of the app. Maestro flows drive the app on an Android emulator while `adb screenrecord` records a clip of each feature, and Remotion puts the clips together with captions and an end card. One command, `npm run video`, does both steps and writes `out/promo.mp4`. The video is 1080 × 1920 at 30 fps.

The sample items in the video have real Rowlet product photos, which belong to their owners. Use the demo build and the video for internal showcases only. To publish the video, e.g., as a Google Play preview, replace the photos with your own first (see the last two sections).

## Before you start

You need these tools:

- Node, and `npm install` run in this folder.
- The Android SDK with `adb`, the emulator, and an x86_64 system image. On Linux, the emulator needs access to `/dev/kvm`.
- An emulator with the Pixel 2 hardware profile, because its 1080 × 1920 screen has the same shape as the video. For example, run `avdmanager create avd -n grailbox_promo -k "system-images;android-36;google_apis;x86_64" -d pixel_2`.
- [Maestro](https://docs.maestro.dev/getting-started/installing-maestro).
- On Linux and WSL, the NSS libraries for Remotion's headless Chrome, with `sudo apt-get install libnss3`.

## Make the video

First, make the demo build's images, which aren't in git because they are product photos. Run `npm run products` and then `npm run demo-assets` in this folder. The last section explains both.

Second, build the demo version of the app and install it on the emulator. The demo build is a normal release build with `EXPO_PUBLIC_DEMO=1` set, and the next section explains what that flag changes. You can build it in the cloud and install the APK. The images go up with the project, because `.easignore` keeps them, while `.gitignore` leaves them out.

```sh
npx eas-cli@latest build --profile demo --platform android
adb install path/to/the-downloaded.apk
```

Or you can build it locally from the repository root:

```sh
EXPO_PUBLIC_DEMO=1 npx expo run:android --variant release
```

If you change an image in `assets/demo/` but keep its file name, a local build can keep the old image, because Gradle doesn't notice the change. Delete `android/app/build/generated/res/react` before you build again.

Third, start the emulator, e.g., with `emulator -avd grailbox_promo -no-window -no-audio -gpu swiftshader_indirect`, and run `npm run video` in this folder. The capture step clears the app's data, loads the sample data, records six clips into `public/clips/`, and then renders `out/promo.mp4`. It takes about 4 minutes. During the recording, Android's demo mode shows a fixed clock and a full battery in the status bar.

The capture step shortens every stretch where the screen doesn't change, because Maestro takes a few seconds to start each flow and about a second between steps. It cuts these stretches to 0.3 seconds at the start and end of a clip, and to 1 second in between. The script doesn't use Maestro's own `startRecording` command, because Maestro records at 100 kbps, which is too low for a store video.

## How the demo build works

The emulator has no real camera, so the demo build changes two things in the app. The code is in `src/features/demo/demo.ts`, and store builds never set the flag.

- The scanner shows still images from `assets/demo/` in place of the camera, and "Check this item" runs the real photo matcher on them. The first image is the Moncolle figure, which you own. "Scan Again" switches to the Juggling Plush, which is on your wishlist.
- "Load sample data" also gives every sample item a product photo from `assets/demo/`, because the photo matcher needs item photos to compare with. It also leaves out the sample barcodes, so the video doesn't show the barcode feature.

## Change the video

The captions, the scene order, and the timing are in `src/scenes.ts`. To record a new scene, add a flow to `maestro/`, add it to `STEPS` in `scripts/capture.sh` with a leading `@`, and add a scene with the same clip name to `src/scenes.ts`. You can trim the start or end of a clip, speed a clip up, or hold its last frame for longer. Run `npm run studio` to preview the video in a browser as you edit. If you have no device at hand, `npm run clips:sample` makes stand-in clips so that you can still work on the layout.

Google Play autoplays the first 30 seconds of the video without sound, so the captions need to tell the story. Its rules also forbid calls to action like "Download now" and claims like "#1", "Best", or "Free" in the video.

To add music, put a file at `public/music.mp3`. Use a royalty-free track, because copyrighted music can get a YouTube Content ID claim, which puts ads on the video, and Google Play doesn't allow a preview video with ads.

## Product photos

The product photos come from the product pages of japan-figure.com. `npm run products` downloads them into `public/products/`, and the list of products is in `scripts/fetch-products.sh`. Then `npm run demo-assets` makes the images in `assets/demo/` from them. Neither folder is in git, because the repository is public. Builds without `EXPO_PUBLIC_DEMO=1` don't need the images, because `metro.config.js` gives them an empty stand-in for `src/features/demo/assets.ts`.


- `<item>.jpg` is each sample item's photo, on a white square.
- `scan-owned.jpg` and `scan-wishlist.jpg` are what the scanner "sees". Each one puts a product photo on a desk in a 1080 × 1920 portrait image, in the middle, where the scanner's guides sit.

A scan only counts as a match when the item scores at least 0.7 and leads the next item by at least 0.1. The figure's scene uses a different photo than the figure's own, as a real scan would. The plush's scene reuses the plush's own photo, because the sample plushes look so much alike that no other photo of the plush got the 0.1 lead. If a scene doesn't match, its flow stops the capture step with an error.

To use your own photos, put them in `assets/demo/` with the same file names, and don't run `npm run demo-assets` after that, because it overwrites them.

## Publish on Google Play

Google Play only plays a YouTube link, so you upload `out/promo.mp4` to YouTube yourself. Google Play requires the video to be public or unlisted, with monetization turned off and no age restriction. Paste the `youtube.com/watch?v=` link into the store listing in Play Console.
