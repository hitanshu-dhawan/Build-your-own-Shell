#!/bin/sh

set -e # Exit early if any commands fail

# - Edit this to change how your program runs locally
exec bun run $(dirname $0)/app/main.ts "$@"
