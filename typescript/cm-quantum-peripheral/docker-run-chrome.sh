#!/usr/bin/env bash

main() {
  "$BASE_ROOT_DIR"/layers/playwright/docker-run-chrome.sh "$CM_CHROME_DATA_DIR"
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../base/main.sh
