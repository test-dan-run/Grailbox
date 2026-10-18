# Grailbox

Grailbox is a mobile app for people who collect pop culture items, e.g., plush toys and figures. You can log the items you own, keep a wishlist of items you want, and check whether you already own an item before you buy it. The scanner checks an item by its barcode or by a photo of it.

The app works offline and for one person. It has no accounts, no sync, and no network calls, so your photos never leave the phone.

The design comes from the Grailbox design canvas. For how the app is built and why, see [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md).

## Before you start

The app uses Expo SDK 58, React Native 0.88, and TypeScript. It needs a development build, which is a build of the app that includes its own native code, and it won't run in Expo Go. The reason is that the scanner matches photos with a native machine learning library that Expo Go doesn't include.

You can make the development build on your own computer or in the cloud with EAS, which is Expo's build service. A local build needs Android Studio for Android, or Xcode on a Mac for iOS. A cloud build needs a free Expo account.

## Run the app

To build and run on your own computer, install the packages and then start the build:

```sh
npm install
npx expo run:android   # or: npx expo run:ios
```

To build in the cloud and run on an Android phone, follow these steps:

1. Run `npm install`.
2. Run `npx eas-cli@latest build --profile development --platform android`.
3. Install the APK from the build page on your phone.
4. Run `npx expo start --dev-client`, and open Grailbox on the phone.

## Commands

| Command | What it does |
| --- | --- |
| `npm run lint` | Runs ESLint with `eslint-config-expo`. |
| `npm run type-check` | Runs `tsc --noEmit`. |
| `npm test` | Runs the Jest tests. |
| `npm run e2e` | Runs the Maestro flows in `.maestro/`. You need a simulator or phone with a development build installed, because the flows load the sample data. |
| `npm run db:generate` | Creates a Drizzle migration after you edit `src/db/schema.ts`. |

CI runs lint, the type check, the tests, and an iOS and Android bundle on every push. The workflow is in `.github/workflows/ci.yml`.

When those checks pass, CI also builds an Android release APK for arm64 phones. To get it, open the run on the Actions tab and download the `grailbox-<commit>` file under Artifacts. It's a zip with the APK inside. The APK is signed with the debug key, so you can install it on a phone but can't upload it to the Play Store. GitHub keeps it for 30 days. You can also start a build by hand with "Run workflow" on the Actions tab.

## Store video

The `video/` folder makes a showcase video from screen recordings of a demo build of the app. The demo build uses real Rowlet product photos, so the video is for internal showcases only. See [video/README.md](video/README.md).

## Web preview

Web isn't a supported platform, but you can preview the screens in a browser for design review with `npx expo start --web`. The camera and photo capture don't work on web.
