#!/usr/bin/env bash
# Records the store video's clips on the connected Android emulator or phone,
# which must have the demo build installed. Runs the flows in maestro/ in the
# order of STEPS. For a flow with a leading @, adb screenrecord records while
# it runs, and the clip goes to public/clips/ under the flow's name. The other
# flows move the app along off camera.
#
# Maestro's own startRecording records at 100 kbps, too low for a store video,
# so this records with screenrecord. Maestro also takes a few seconds to start
# each flow, so the still frames at either end of a recording are cut off.
set -euo pipefail
cd "$(dirname "$0")/.."

STEPS=(setup @01-barcode @02-photo close-scanner @03-collection @04-item back @05-journal relaunch @06-wishlist)
DEVICE_FILE=/sdcard/grailbox-clip.mp4

for tool in adb maestro ffmpeg; do
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

work=$(mktemp -d)
cleanup() {
  adb shell pkill -INT screenrecord >/dev/null 2>&1 || true
  bash scripts/statusbar.sh off
}
trap cleanup EXIT
bash scripts/statusbar.sh on
rm -rf public/clips
mkdir -p public/clips

flow() {
  echo "maestro/$1.yaml"
  if ! maestro test --test-output-dir="$work/maestro" "maestro/$1.yaml" >"$work/$1.log" 2>&1; then
    tail -n 30 "$work/$1.log" >&2
    echo "Screenshots and logs: $work/maestro" >&2
    return 1
  fi
}

# Shortens every stretch where the screen doesn't change: to 0.3 s at the
# start and end of a recording, and to 1 s in between, since Maestro takes a
# few seconds to start a flow and about a second between steps. Also converts
# to a constant 30 fps (screenrecord only writes a frame when the screen changes).
trim() {
  local in=$1 out=$2 duration cuts
  duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")
  cuts=$(
    ffmpeg -hide_banner -nostats -i "$in" -vf "fps=30,freezedetect=n=0.003:d=0.5" -an -f null - 2>&1 |
      awk -v dur="$duration" '
        function cut(a, b) { if (b > a) expr = expr (expr ? "+" : "") "between(t," a "," b ")" }
        BEGIN { s = -1 }
        /freeze_start:/ { s = $NF + 0 }
        /freeze_end:/ { e = $NF + 0; if (s < 1) cut(0, e - 0.3); else cut(s + 1, e); s = -1 }
        END { if (s >= 0) cut(s + 0.3, dur + 1); print expr ? expr : "0" }'
  )
  ffmpeg -loglevel error -y -i "$in" -vf "fps=30,select='not($cuts)',setpts=N/30/TB" \
    -c:v libx264 -crf 14 -preset slow -pix_fmt yuv420p -an "$out"
}

record() {
  local clip=$1
  adb shell screenrecord --bit-rate 20000000 --time-limit 180 "$DEVICE_FILE" &
  local recorder=$!
  sleep 1
  flow "$clip"
  # screenrecord writes the last change a moment after Maestro sees it.
  sleep 1
  adb shell pkill -INT screenrecord
  wait "$recorder" || true
  adb pull "$DEVICE_FILE" "$work/$clip.mp4" >/dev/null
  adb shell rm "$DEVICE_FILE"
  trim "$work/$clip.mp4" "public/clips/$clip.mp4"
  echo "  public/clips/$clip.mp4 ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "public/clips/$clip.mp4") s)"
}

for step in "${STEPS[@]}"; do
  if [[ $step == @* ]]; then record "${step#@}"; else flow "$step"; fi
done

missing=0
for clip in $(grep -oP "clip: '\K[^']+" src/scenes.ts); do
  [ -f "public/clips/$clip.mp4" ] || { echo "src/scenes.ts uses a clip that wasn't recorded: $clip" >&2; missing=1; }
done
exit $missing
