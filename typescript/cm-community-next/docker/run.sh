#!/usr/bin/env bash

main() {
  cd "$BASE_SCRIPT_DIR"
  print_and_exec docker rm -f cm-community-next
  print_and_exec docker run \
    -it \
    --rm \
    --name cm-community-next \
    -p 3000:3000 \
    "$(cat ./image.txt)"
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
