#!/usr/bin/env bash

main() {
  local minion_pod=$1

  print_progress 'dev.rabbit.tech URL:'
  echo "https://dev.rabbit.tech/minions/${minion_pod}/http-novnc/vnc_lite.html?path=minions/${minion_pod}/http-novnc/websockify"

  print_progress '`kubectl proxy` URL:'
  echo "http://localhost:8001/api/v1/namespaces/quantum-minions/services/$minion_pod:http-novnc/proxy/vnc_lite.html?path=api/v1/namespaces/quantum-minions/services/$minion_pod:http-novnc/proxy/websockify"
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
