#!/usr/bin/env bash

main() {
  "$BASE_SCRIPT_DIR"/os2-deploy.sh \
    quantum-us-west2-230409 \
    os2-dev \
    os2-next
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
