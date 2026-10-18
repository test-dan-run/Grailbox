#!/usr/bin/env bash
# Makes stand-in clips for every scene in src/scenes.ts, so you can work on
# the video's layout and captions without a device. npm run capture replaces them.
set -euo pipefail
cd "$(dirname "$0")/.."

font=../node_modules/@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf
mkdir -p public/clips
for clip in $(grep -oP "clip: '\K[^']+" src/scenes.ts); do
  ffmpeg -loglevel error -y -f lavfi -i "testsrc2=size=1080x1920:rate=30:duration=4" \
    -vf "drawtext=fontfile=$font:text='$clip':fontsize=96:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=24:x=(w-tw)/2:y=(h-th)/2" \
    -c:v libx264 -pix_fmt yuv420p "public/clips/$clip.mp4"
  echo "public/clips/$clip.mp4"
done
