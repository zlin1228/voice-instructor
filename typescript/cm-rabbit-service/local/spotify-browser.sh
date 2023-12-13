#!/usr/bin/env bash

main() {
  source "$BASE_ROOT_DIR"/dev/deps/node/activate

  
  cd "$BASE_SCRIPT_DIR"/..

  "$BASE_SCRIPT_DIR"/build-fast.sh

  cd "$BASE_SCRIPT_DIR"/../wd
  export PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1
  print_and_exec node \
    --experimental-specifier-resolution=node \
    --enable-source-maps \
    "$BASE_SCRIPT_DIR"/../lib/playground/test-spotify-browser.js
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
