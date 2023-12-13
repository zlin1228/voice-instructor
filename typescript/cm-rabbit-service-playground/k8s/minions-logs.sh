#!/usr/bin/env bash

main() {
  local minion_pod=$1

  source "$BASE_ROOT_DIR"/clusters/quantum-us-west2-230409/activate
  print_and_exec kubectl -n quantum-minions logs pod/"$minion_pod" -f
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
