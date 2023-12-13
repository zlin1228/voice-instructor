#!/usr/bin/env bash

print_deps_for_package() {
  local package=$1
  for p in $(cat "$BASE_SCRIPT_DIR"/../"$package"/dep.txt); do
    print_deps_for_package "$p"
  done
  echo "$package"
}

main() {
  local p=$1
  print_deps_for_package "$p" | awk '!visited[$0]++'
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../base/main.sh