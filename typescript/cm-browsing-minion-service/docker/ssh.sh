#!/usr/bin/env bash

main() {
  SSHPASS=ytytyt print_and_exec sshpass -e \
    ssh -o StrictHostKeyChecking=no -p 4022 yt@localhost \
    "$@"
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
