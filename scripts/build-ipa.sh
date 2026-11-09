#!/usr/bin/env bash
#
# Build an unsigned release .ipa for sideloading via SideStore.
#
# SideStore re-signs the app with your own Apple ID at install time, so the build
# itself is unsigned (CODE_SIGNING_ALLOWED=NO). The result is a standalone
# Release build with the JS bundle embedded — it runs without a Metro server.
#
# Usage:  ./scripts/build-ipa.sh
# Output: ./TuneUp.ipa  (in the project root)
#
# If you changed native config since the last build, regenerate ios/ first:
#   npx expo prebuild -p ios
set -euo pipefail

cd "$(dirname "$0")/.."

WORKSPACE="ios/TuneUp.xcworkspace"
SCHEME="TuneUp"
DERIVED="./build"
PRODUCTS="$DERIVED/Build/Products/Release-iphoneos"

echo "==> Building unsigned Release .app for device..."
rm -rf "$DERIVED"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -sdk iphoneos \
  -derivedDataPath "$DERIVED" \
  CODE_SIGNING_ALLOWED=NO

APP_PATH="$PRODUCTS/$SCHEME.app"
if [ ! -d "$APP_PATH" ]; then
  echo "Build succeeded but $APP_PATH was not found." >&2
  exit 1
fi

echo "==> Packaging into TuneUp.ipa..."
rm -rf "$PRODUCTS/Payload" "$PRODUCTS/$SCHEME.ipa"
mkdir -p "$PRODUCTS/Payload"
cp -R "$APP_PATH" "$PRODUCTS/Payload/"
( cd "$PRODUCTS" && zip -qr "$SCHEME.ipa" Payload )
rm -rf "$PRODUCTS/Payload"
cp "$PRODUCTS/$SCHEME.ipa" "./$SCHEME.ipa"

echo "==> Done: $(pwd)/$SCHEME.ipa"
echo "    Open it with SideStore to sideload."
