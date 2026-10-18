#!/usr/bin/env bash
# Makes the demo build's images in assets/demo/ (src/features/demo/demo.ts)
# from the product photos in public/products/ (scripts/fetch-products.sh):
# - <item>.jpg, each sample item's photo, on a white 1080 px square;
# - scan-*.jpg, the scanner's "camera" scenes. The figure's scene is a
#   different photo than the figure's own, as a real scan would be. The plush's
#   scene reuses the plush's own photo: the sample plushes look so alike that
#   the matcher doesn't pick out the plush from another photo of it with the
#   lead it needs (MATCH_MIN_GAP).
set -euo pipefail
cd "$(dirname "$0")/.."

out=../assets/demo
mkdir -p "$out"

# item  photo number
ITEM_PHOTOS="
jumbo-plush 0
juggling-plush 0
pokedoll 2
moncolle-figure 0
acrylic-stand 0
enamel-pin 0
sitting-cuties-plush 0
figure 0
"
echo "$ITEM_PHOTOS" | while read -r item n; do
  [ -n "$item" ] || continue
  ffmpeg -loglevel error -y -i "public/products/$item-$n.jpg" -q:v 3 \
    -vf "scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:white" "$out/$item.jpg"
  echo "$out/$item.jpg"
done

still() { npx remotion still DemoScanScene "$1" --props="{\"src\":\"products/$2\"}" --image-format=jpeg --jpeg-quality=90 --log=error; echo "$1"; }
still "$out/scan-owned.jpg" moncolle-figure-1.jpg
still "$out/scan-wishlist.jpg" juggling-plush-0.jpg
