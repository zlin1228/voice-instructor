#!/usr/bin/env bash

main() {
  source "$BASE_ROOT_DIR"/dev/deps/node/activate

  print_and_exec node \
    --experimental-specifier-resolution=node \
    "$BASE_SCRIPT_DIR"/lib/build-python-types.js
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../base/main.sh
