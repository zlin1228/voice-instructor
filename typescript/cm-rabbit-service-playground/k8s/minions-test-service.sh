#!/usr/bin/env bash

main() {
  local minion_pod=$1

  print_and_exec curl \
    -v "https://dev.rabbit.tech/minions/${minion_pod}/8080/healthz"
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
