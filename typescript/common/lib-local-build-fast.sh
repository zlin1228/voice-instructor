#!/usr/bin/env bash

main() {
  source "$BASE_ROOT_DIR"/dev/deps/node/activate
  
  local package=$1

  cd "$BASE_SCRIPT_DIR"/../"$package"
  if [[ -f next.config.js ]]; then
    if [[ -d src ]]; then
      print_and_exec npx eslint src
    fi
    export NEXT_TELEMETRY_DISABLED=1
    print_and_exec npm run build
  else
    print_and_exec npx tsc -b
  fi
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../base/main.sh
