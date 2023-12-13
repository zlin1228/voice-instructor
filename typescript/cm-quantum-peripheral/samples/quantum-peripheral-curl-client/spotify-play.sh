#!/usr/bin/env bash

main() {
  # To get a valid token, visit: https://developer.spotify.com/
  local server_address=${1:-http://localhost:8080}
  print_and_exec curl \
    -X POST \
    -H "Content-Type: application/json" \
    -d @"$BASE_SCRIPT_DIR"/spotify-play.json \
    "$server_address"/quantum-peripheral/spotifyPlay
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../../base/main.sh
