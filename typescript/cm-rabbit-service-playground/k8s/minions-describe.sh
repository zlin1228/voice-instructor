#!/usr/bin/env bash

main() {
  local minion_pod=$1

  source "$BASE_ROOT_DIR"/clusters/quantum-us-west2-230409/activate
  kubectl -n quantum-minions describe pod/"$minion_pod"
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
