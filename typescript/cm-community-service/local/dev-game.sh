#!/usr/bin/env bash

main() {
  "$BASE_SCRIPT_DIR"/build-fast.sh
  LIGHTSPEED_GAME_ENGINE=1 "$BASE_SCRIPT_DIR"/run.sh
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
