#!/usr/bin/env bash

main() {
  local tag=$(generate_tag)
  local image=us-docker.pkg.dev/cmc-ai/quantum/playwright:"$tag"

  "$BASE_ROOT_DIR"/layers/playwright/docker-build.sh
  print_and_exec docker tag playwright:local "$image"
  print_and_exec docker push "$image"
  print_message "Built and pushed docker image [$image]"
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../base/main.sh
