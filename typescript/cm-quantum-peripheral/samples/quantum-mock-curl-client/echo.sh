#!/usr/bin/env bash

main() {
  local server_address=${1:-http://localhost:8080}

  print_and_exec curl \
    -X POST \
    -H "Content-Type: application/json" \
    -d @"$BASE_SCRIPT_DIR"/echo.json \
    "$server_address"/quantum-mock/mockEchoV1
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../../base/main.sh
