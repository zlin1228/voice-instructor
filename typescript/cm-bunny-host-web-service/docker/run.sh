#!/usr/bin/env bash

main() {
  export CM_BROWSING_MINION_SELF_HOST_FOR_WEBRTC=${CM_BROWSING_MINION_SELF_HOST_FOR_WEBRTC:-$(hostname)}

  cd "$BASE_SCRIPT_DIR"
  print_and_exec docker run \
    -d --rm \
    --name cm-bunny-host-web \
    -p 9222:9222 \
    -p 4022:22 \
    -p 6081:6081 \
    -p 8080:8080 \
    --env CM_BUNNY_HOST_WEB_DEBUG \
    --env CM_BROWSING_MINION_SELF_HOST_FOR_WEBRTC \
    --security-opt seccomp=unconfined \
    --shm-size=1gb \
    --mount type=bind,source="$BASE_SCRIPT_DIR"/logs,target=/home/yt/repo/layers/cm-bunny-host-web/logs \
    -v "$BASE_ROOT_DIR"/credentials/cm-gcp-service-account-quantum-workload:/credentials/cm-gcp-service-account-quantum-workload \
    -e GOOGLE_APPLICATION_CREDENTIALS=/credentials/cm-gcp-service-account-quantum-workload/gcp-service-account-quantum-workload.json \
    "$(cat ./image.txt)" \
    /bin/bash -c \
    '"$@"' \
    -- \
    /home/yt/repo/layers/cm-bunny-host-web/scripts/entrypoint.sh
  trap "docker rm -f cm-bunny-host-web" INT
  print_and_exec docker logs cm-bunny-host-web -f || true
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
