#!/usr/bin/env bash

main() {
  local server_port=${1:-8080}

  print_var server_port

  source "$BASE_ROOT_DIR"/dev/assets-linux-amd64/node/activate

  cd "$BASE_SCRIPT_DIR"/../wd
  print_and_exec node \
    --experimental-specifier-resolution=node \
    "$BASE_SCRIPT_DIR"/../lib/index.js
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
