#!/usr/bin/env bash

main() {
  source "$BASE_ROOT_DIR"/clusters/quantum-us-west2-230409/activate

  "$BASE_SCRIPT_DIR"/build-fast.sh
  "$BASE_SCRIPT_DIR"/run.sh
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
