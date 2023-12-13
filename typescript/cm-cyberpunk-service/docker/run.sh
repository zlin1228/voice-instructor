#!/usr/bin/env bash

main() {
  cd "$BASE_SCRIPT_DIR"
  print_and_exec docker rm -f cm-cyberpunk-service
  print_and_exec docker run \
    -it \
    --rm \
    --name cm-cyberpunk-service \
    -p 8080:8080 \
    "$(cat ./image.txt)"
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
