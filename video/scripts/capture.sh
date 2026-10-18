#!/usr/bin/env bash
# Records the store video's clips: runs maestro/promo.yaml on the connected
# Android emulator or phone, which must have the demo build installed, and
# copies each startRecording clip into public/clips/.
set -euo pipefail
cd "$(dirname "$0")/.."

for tool in adb maestro; do
  command -v "$tool" >/dev/null || { echo "$tool is not installed. See README.md." >&2; exit 1; }
done
if ! adb get-state >/dev/null 2>&1; then
  echo "No Android device or emulator found (adb devices)." >&2
  exit 1
fi
if ! adb shell pm path app.grailbox >/dev/null 2>&1; then
  echo "Grailbox is not installed. Install the demo build first. See README.md." >&2
  exit 1
fi

results=$(mktemp -d)
bash scripts/statusbar.sh on
trap 'bash scripts/statusbar.sh off' EXIT
maestro test --test-output-dir="$results" maestro/promo.yaml

rm -rf public/clips
mkdir -p public/clips
find "$results" -path '*/startRecording/*.mp4' -exec cp {} public/clips/ \;

missing=0
for clip in $(grep -oP "clip: '\K[^']+" src/scenes.ts); do
  if [ -f "public/clips/$clip.mp4" ]; then echo "public/clips/$clip.mp4"; else echo "Missing clip: $clip" >&2; missing=1; fi
done
exit $missing
