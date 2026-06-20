#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_PATH="src-tauri/target/release/bundle/macos/Local JSON Hero.app"
DMG_PATH="src-tauri/target/release/bundle/dmg/Local JSON Hero_0.1.0_aarch64.dmg"
NOTARY_PROFILE="${NOTARY_PROFILE:-LocalJSONHero}"

find_developer_id_identity() {
  security find-identity -v -p codesigning |
    awk -F\" '/Developer ID Application/ { print $2; exit }'
}

SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-$(find_developer_id_identity)}"

if [[ -z "$SIGNING_IDENTITY" ]]; then
  cat >&2 <<'EOF'
Missing Developer ID Application certificate.

Install a "Developer ID Application" certificate from your Apple Developer
account, then run this script again.

Check installed identities with:
  security find-identity -v -p codesigning
EOF
  exit 2
fi

if ! xcrun notarytool history --keychain-profile "$NOTARY_PROFILE" >/dev/null 2>&1; then
  cat >&2 <<EOF
Missing notarytool keychain profile: $NOTARY_PROFILE

Create it locally with an Apple app-specific password:
  xcrun notarytool store-credentials "$NOTARY_PROFILE" \\
    --apple-id "you@example.com" \\
    --team-id "YOUR_TEAM_ID" \\
    --password "APP_SPECIFIC_PASSWORD"

Or use App Store Connect API key credentials if you prefer that flow.
Do not commit passwords, API keys, or .p8 files to this repository.
EOF
  exit 3
fi

echo "Using signing identity: $SIGNING_IDENTITY"
echo "Using notarytool profile: $NOTARY_PROFILE"

npm run build:types
APPLE_SIGNING_IDENTITY="$SIGNING_IDENTITY" npm run desktop:build

codesign --verify --deep --strict --verbose=2 "$APP_PATH"

echo "Signing DMG..."
codesign --force --timestamp --sign "$SIGNING_IDENTITY" "$DMG_PATH"
codesign --verify --verbose=2 "$DMG_PATH"

echo "Submitting DMG for notarization..."
xcrun notarytool submit "$DMG_PATH" \
  --keychain-profile "$NOTARY_PROFILE" \
  --wait

echo "Stapling notarization tickets..."
xcrun stapler staple "$DMG_PATH"
xcrun stapler validate "$DMG_PATH"

echo "Validating Gatekeeper assessment..."
spctl -a -vvv -t open --context context:primary-signature "$DMG_PATH"

cat <<EOF
Signed and notarized:
  $DMG_PATH

Share this DMG with macOS users.
EOF
