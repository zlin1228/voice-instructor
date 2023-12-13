#!/usr/bin/env bash

main() {
  "$BASE_SCRIPT_DIR"/../../build-python-types.sh > "$BASE_SCRIPT_DIR"/src/schema.py
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../../base/main.sh
