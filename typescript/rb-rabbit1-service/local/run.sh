#!/usr/bin/env bash

main() {
  source "$BASE_ROOT_DIR"/dev/deps/node/activate

  cd "$BASE_SCRIPT_DIR"/../wd
  print_and_exec node \
    --experimental-specifier-resolution=node \
    --enable-source-maps \
    "$BASE_SCRIPT_DIR"/../lib/main.js
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
