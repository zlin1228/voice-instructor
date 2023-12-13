#!/usr/bin/env bash

main() {
  cd "$BASE_SCRIPT_DIR"

  local image=$(cat ./repo.txt):$(generate_tag)

  "$BASE_ROOT_DIR"/layers/build-image.sh \
    cm-community-speech-server \
    "$image"
  echo "$image" > image.txt
  print_message "Built docker image [$image]"
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
