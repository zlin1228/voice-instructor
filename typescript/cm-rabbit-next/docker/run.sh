#!/usr/bin/env bash

main() {
  cd "$BASE_SCRIPT_DIR"
  print_and_exec docker rm -f cm-rabbit-next
  print_and_exec docker run \
    -it \
    --rm \
    --name cm-rabbit-next \
    -p 3000:3000 \
    -v "$BASE_ROOT_DIR"/credentials/cm-gcp-service-account-quantum-workload:/credentials/cm-gcp-service-account-quantum-workload \
    --env-file ../.env.development \
    -e GOOGLE_APPLICATION_CREDENTIALS=/credentials/cm-gcp-service-account-quantum-workload/gcp-service-account-quantum-workload.json \
    -e CM_PERIPHERAL_ADDRESS=http://host.docker.internal:8080/quantum-peripheral \
    "$(cat ./image.txt)"
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
