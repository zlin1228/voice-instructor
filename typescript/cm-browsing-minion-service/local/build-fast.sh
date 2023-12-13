#!/usr/bin/env bash

main() {
  "$BASE_SCRIPT_DIR"/../../common/lib-local-build-fast.sh \
    "$(basename "$(realpath "$BASE_SCRIPT_DIR"/..)")"
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
