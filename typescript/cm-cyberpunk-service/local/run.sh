#!/usr/bin/env bash

main() {
  local server_port=${1:-8080}

  print_var server_port

  source "$BASE_ROOT_DIR"/dev/deps/node/activate
  source "$BASE_ROOT_DIR"/dev/deps/ffmpeg/activate

  cd "$BASE_SCRIPT_DIR"/../wd
  export PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1
  print_and_exec node \
    --experimental-specifier-resolution=node \
    --enable-source-maps \
    "$BASE_SCRIPT_DIR"/../lib/index.js
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
