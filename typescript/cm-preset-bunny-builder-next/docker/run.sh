#!/usr/bin/env bash

main() {
  cd "$BASE_SCRIPT_DIR"
  print_and_exec docker rm -f cm-preset-bunny-builder-next
  print_and_exec docker run \
    -it \
    --rm \
    --name cm-preset-bunny-builder-next \
    -p 3000:3000 \
    "$(cat ./image.txt)"
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
