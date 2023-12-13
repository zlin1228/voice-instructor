#!/usr/bin/env bash

main() {
  local gcs_path=gs://quantum-engine/caod
  cd "$BASE_SCRIPT_DIR"
  print_and_exec gsutil cp wd/item-with-urls.json "$gcs_path"/item-with-urls.json
  print_and_exec gsutil -m cp -r wd/images "$gcs_path"/images
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../base/main.sh
