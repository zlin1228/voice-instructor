#!/usr/bin/env bash

main() {
  source "$BASE_ROOT_DIR"/dev/deps/node/activate
  
  local package=$1

  cd "$BASE_SCRIPT_DIR"/../"$package"
  print_and_exec npx tsc -b --watch
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../base/main.sh
