#!/usr/bin/env bash

main() {
  source "$BASE_ROOT_DIR"/dev/deps/node/activate
  
  cd "$BASE_SCRIPT_DIR"
  print_and_exec npm install
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../base/main.sh
