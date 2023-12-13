#!/usr/bin/env bash

main() {
  source "$BASE_ROOT_DIR"/dev/deps/node/activate
  
  local package=$1

  cd "$BASE_SCRIPT_DIR"/../"$package"
  print_and_exec npm install
  if [[ -f next.config.js ]]; then
    if [[ -d app ]] || [[ -d src/app ]]; then
      export NEXT_TELEMETRY_DISABLED=1
      print_and_exec npm run build
    else
      print_message "Skipped building because 'app' directory doesn't exists"
    fi
  else
    if [[ -d src ]]; then
      print_and_exec rm -f tsconfig.tsbuildinfo
      print_and_exec rm -rf lib
      print_and_exec npx eslint src
      print_and_exec npx tsc -b --force
    else
      print_message "Skipped building because 'src' directory doesn't exists"
    fi
  fi
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../base/main.sh
