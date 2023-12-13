#!/usr/bin/env bash

main() {
  local server_address=${1:-http://localhost:8080}

  print_and_exec curl \
    -X POST \
    -H "Content-Type: application/json" \
    -d @"$BASE_SCRIPT_DIR"/mediawiki-search.json \
    "$server_address"/quantum-peripheral/mediawikiSearch
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../../base/main.sh
