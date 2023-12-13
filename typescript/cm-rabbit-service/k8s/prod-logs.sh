#!/usr/bin/env bash

main() {
  source "$BASE_ROOT_DIR"/clusters/quantum-us-west2-230409/activate

  kubectl -n os2-prod logs deploy/os2-service "$@"
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
