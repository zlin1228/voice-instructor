#!/usr/bin/env bash

main() {
  local rtpPort=$1
  local rtcpPort=$2

  export CM_BROWSING_MINION_SELF_HOST_FOR_WEBRTC=${CM_BROWSING_MINION_SELF_HOST_FOR_WEBRTC:-$(hostname)}

  cd "$BASE_SCRIPT_DIR"
  print_and_exec docker run \
    -d --rm \
    --name cm-browsing-minion \
    -p 9222:9222 \
    -p 4022:22 \
    -p 6081:6081 \
    --env BASE_PROFILE=docker \
    --env CM_BROWSING_MINION_SELF_HOST_FOR_WEBRTC \
    --security-opt seccomp=unconfined \
    --shm-size=1gb \
    --mount type=bind,source="$BASE_SCRIPT_DIR"/logs,target=/home/yt/repo/layers/cm-browsing-minion/logs \
    -v "$BASE_ROOT_DIR"/credentials/cm-gcp-service-account-quantum-workload:/credentials/cm-gcp-service-account-quantum-workload \
    -e GOOGLE_APPLICATION_CREDENTIALS=/credentials/cm-gcp-service-account-quantum-workload/gcp-service-account-quantum-workload.json \
    "$(cat ./image.txt)" \
    /bin/bash -c \
    '"$@"' \
    -- \
    /home/yt/repo/layers/cm-browsing-minion/scripts/browsing.sh \
    "$(hostname)" \
    "$rtpPort" \
    "$rtcpPort"
  trap "docker rm -f cm-browsing-minion" INT
  print_and_exec docker logs cm-browsing-minion -f || true
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
