#!/usr/bin/env bash

main() {
  local p=$1
  shift
  for dep in $("$BASE_SCRIPT_DIR"/pkg-deps-print.sh "$p"); do
    (
      print_progress "Processing package [$dep] ..."
      cd "$BASE_SCRIPT_DIR"/../"$dep"
      print_and_exec "$@"
    )
  done
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../base/main.sh