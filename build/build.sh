#!/usr/bin/env bash
# Usage: bash build/build.sh [en|ar]   (SAMPLE=1 also builds files starting with "_")
set -euo pipefail
cd "$(dirname "$0")/.."
exec python3 build/build.py "$@"
