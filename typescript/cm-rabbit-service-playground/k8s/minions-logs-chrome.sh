#!/usr/bin/env bash

main() {
  local minion_pod=$1

  source "$BASE_ROOT_DIR"/clusters/quantum-us-west2-230409/activate
  kubectl -n quantum-minions exec -t pod/"$minion_pod" -- \
    /bin/bash -c 'tail -f -n +1 /home/yt/repo/layers/cm-browsing-minion/logs/chrome.log | less -R'
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
