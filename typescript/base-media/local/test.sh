#!/usr/bin/env bash

main() {
  cd "$BASE_SCRIPT_DIR"
  ./build-fast.sh
  ./run.sh
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
