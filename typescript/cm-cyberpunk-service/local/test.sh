#!/usr/bin/env bash

main() {
  source "$BASE_ROOT_DIR"/clusters/quantum-us-west2-230409/activate
  source "$BASE_ROOT_DIR"/dev/deps/node/activate
  source "$BASE_ROOT_DIR"/dev/deps/ffmpeg/activate
  source "$BASE_ROOT_DIR"/credentials/cm-gcp-service-account-quantum-workload/activate
  
  cd "$BASE_SCRIPT_DIR"/..
  print_and_exec npx eslint src

  "$BASE_SCRIPT_DIR"/build-fast.sh

  cd "$BASE_SCRIPT_DIR"/../wd
  export PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1
  print_and_exec node \
    --experimental-specifier-resolution=node \
    --enable-source-maps \
    "$BASE_SCRIPT_DIR"/../lib/index.js
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
