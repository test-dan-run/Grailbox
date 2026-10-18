#!/usr/bin/env bash
# Renders the placeholder images in assets/demo/ that the demo build uses
# (src/features/demo/demo.ts). Overwrites them, so skip this once you have
# swapped in real photos.
set -euo pipefail
cd "$(dirname "$0")/.."

out=../assets/demo
mkdir -p "$out"
still() { npx remotion still "$@" --image-format=jpeg --jpeg-quality=90 --log=error; }

still DemoItemPhoto "$out/jumbo-plush.jpg" --props='{"item":"jumbo"}'
still DemoItemPhoto "$out/juggling-plush.jpg" --props='{"item":"juggling"}'
still DemoPhotoScene "$out/scan-photo.jpg"
still DemoBarcodeScene "$out/scan-barcode.jpg"
