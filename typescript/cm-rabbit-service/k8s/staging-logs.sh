#!/usr/bin/env bash

main() {
  source "$BASE_ROOT_DIR"/clusters/quantum-us-west2-230409/activate

  kubectl -n os2-staging logs deploy/os2-service -f
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
