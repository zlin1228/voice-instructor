#!/usr/bin/env bash

main() {
  source "$BASE_ROOT_DIR"/dev/deps/node/activate

  cd "$BASE_SCRIPT_DIR"/..
  export NEXT_TELEMETRY_DISABLED=1
  print_and_exec npm run start
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
