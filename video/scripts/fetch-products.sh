#!/usr/bin/env bash
# Downloads the Rowlet product photos the demo build uses, from the product
# pages of japan-figure.com (a Shopify store, so each page has a .json form).
# Saves them as public/products/<item>-<n>.jpg. The photos belong to their
# owners: the demo build and video are for internal showcases only.
set -euo pipefail
cd "$(dirname "$0")/.."

# item  product handle
PRODUCTS="
jumbo-plush takara-tomy-arts-pokemon-pokemon-kimi-ni-kimeta-pokemon-get-stuffed-mokuro-height-approx
juggling-plush pokemon-center-original-plush-mokuro
pokedoll pokemon-fit-rowlet-owl-plush-collectible-soft-stuffed-toy
moncolle-figure pokemon-center-original-moncolle-ms-24-mokuro
acrylic-stand marimo-craft-poke-peace-pokemon-triple-acrylic-key-chain-piplup-amp-mokuro-w5-2-x-h7cm-pkp-033
enamel-pin pokemon-center-original-pokemon-accessory-bangs-clip-61-mokuro
sitting-cuties-plush pokemon-all-star-collection-mokuro-s-plush-height-11-5cm
figure pokemon-plastic-model-collection-quick-10-mokuro-color-coded-plastic-model
"

mkdir -p public/products
echo "$PRODUCTS" | while read -r item handle; do
  [ -n "$item" ] || continue
  curl -fsSL -A "Mozilla/5.0" "https://japan-figure.com/products/$handle.json" |
    python3 -c 'import json, sys; [print(i["src"]) for i in json.load(sys.stdin)["product"]["images"]]' |
    { n=0; while read -r url; do
        curl -fsSL -A "Mozilla/5.0" "$url" -o "public/products/$item-$n.jpg"
        echo "public/products/$item-$n.jpg"
        n=$((n + 1))
      done; }
done
