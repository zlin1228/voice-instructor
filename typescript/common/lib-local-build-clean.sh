#!/usr/bin/env bash

main() {
  source "$BASE_ROOT_DIR"/dev/deps/node/activate
  
  local package=$1

  cd "$BASE_SCRIPT_DIR"/../"$package"
  print_and_exec rm -f tsconfig.tsbuildinfo
  print_and_exec rm -rf lib
  print_and_exec rm -rf node_modules
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../base/main.sh
