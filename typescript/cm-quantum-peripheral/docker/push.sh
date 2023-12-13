#!/usr/bin/env bash

main() {
  cd "$BASE_SCRIPT_DIR"
  print_and_exec docker push "$(cat ./image.txt)"
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
