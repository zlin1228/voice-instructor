#!/usr/bin/env bash

main() {
  source "$BASE_ROOT_DIR"/dev/deps/gcloud/activate

  cd "$BASE_SCRIPT_DIR"
  print_and_exec docker push "$(cat ./image.txt)"
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
