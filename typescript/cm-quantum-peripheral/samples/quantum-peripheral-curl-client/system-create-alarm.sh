#!/usr/bin/env bash

main() {
  local server_address=${1:-http://localhost:8080}

  print_and_exec curl \
    -X POST \
    -H "Content-Type: application/json" \
    -d @"$BASE_SCRIPT_DIR"/system-create-alarm.json \
    "$server_address"/quantum-peripheral/systemCreateAlarm
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../../base/main.sh
