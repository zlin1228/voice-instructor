#!/usr/bin/env bash

main() {
  source "$BASE_ROOT_DIR"/clusters/quantum-us-west2-230409/activate
  source "$BASE_ROOT_DIR"/credentials/cm-gcp-service-account-quantum-workload/activate

  "$BASE_SCRIPT_DIR"/build-fast.sh
  export KUBERNETES_POD_NAMESPACE=${KUBERNETES_POD_NAMESPACE:-os2-dev}
  xvfb-run "$BASE_SCRIPT_DIR"/run.sh
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
