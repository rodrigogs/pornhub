#!/usr/bin/env bash
# Refresh the real-HTML fixtures under test/fixtures/.
# Run after pornhub.com changes its layout on purpose (the fixture tests
# will fail first, then you regenerate with this script and commit).
set -euo pipefail

cd "$(dirname "$0")/.."

UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
FIXTURES="test/fixtures"
mkdir -p "$FIXTURES"

fetch() {
  local name="$1" url="$2"
  curl -s -L -A "$UA" "$url" -o "$FIXTURES/$name"
  echo "$name: $(wc -c < "$FIXTURES/$name") bytes"
}

fetch listing-hottest.html "https://www.pornhub.com/video?o=ht"
fetch listing-pornstar.html "https://www.pornhub.com/pornstar/michael-fly"
fetch listing-channel.html "https://www.pornhub.com/channels/brazzers"
fetch listing-category.html "https://www.pornhub.com/video?c=7"

VIEWKEY="$(grep -oE 'viewkey=[a-zA-Z0-9_-]+' "$FIXTURES/listing-hottest.html" | head -1 | cut -d= -f2)"
if [ -n "$VIEWKEY" ]; then
  fetch video-detail.html "https://www.pornhub.com/view_video.php?viewkey=$VIEWKEY"
else
  echo "WARNING: could not extract a viewkey from the hottest listing; video-detail.html not refreshed"
fi

echo "Done. Run: npm run test:unit"
