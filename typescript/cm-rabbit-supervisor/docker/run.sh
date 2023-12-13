#!/usr/bin/env bash

main() {
  cd "$BASE_SCRIPT_DIR"
  print_and_exec docker rm -f cm-rabbit-supervisor
  # Add --init for xvfb-run. See: https://stackoverflow.com/questions/50634819/xvfb-run-hangs-in-container
  print_and_exec docker run \
    -it \
    --rm \
    --init \
    --name cm-rabbit-supervisor \
    -p 8080:8080 \
    -v "$BASE_ROOT_DIR"/credentials/cm-gcp-service-account-quantum-workload:/credentials/cm-gcp-service-account-quantum-workload \
    -e GOOGLE_APPLICATION_CREDENTIALS=/credentials/cm-gcp-service-account-quantum-workload/gcp-service-account-quantum-workload.json \
    "$(cat ./image.txt)"
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
