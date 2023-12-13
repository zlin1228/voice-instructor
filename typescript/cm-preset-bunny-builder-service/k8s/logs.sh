#!/usr/bin/env bash

main() {
  source "$BASE_ROOT_DIR"/clusters/quantum-us-west2-230409/activate

  kubectl -n cm-preset-bunny-builder logs deploy/preset-bunny-builder-service -f
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
