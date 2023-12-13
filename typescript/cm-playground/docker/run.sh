#!/usr/bin/env bash

main() {
  cd "$BASE_SCRIPT_DIR"
  print_and_exec docker rm -f cm-playground
  print_and_exec docker run \
    -it \
    --rm \
    --name cm-playground \
    -p 3000:3000 \
    -v "$BASE_ROOT_DIR"/credentials/cm-gcp-service-account-quantum-workload:/credentials/cm-gcp-service-account-quantum-workload \
    --env-file ../.env.development \
    -e GOOGLE_APPLICATION_CREDENTIALS=/credentials/cm-gcp-service-account-quantum-workload/gcp-service-account-quantum-workload.json \
    "$(cat ./image.txt)"
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
