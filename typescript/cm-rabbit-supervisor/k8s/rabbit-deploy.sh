#!/usr/bin/env bash

main() {
  local cluster=$1
  local namespace=$2
  local deployment_name=$3
  local container_name=$3

  local cluster_path="$BASE_ROOT_DIR"/clusters/"$cluster"
  local yaml_path="$cluster_path"/yaml/"$namespace"/os2-base/"$deployment_name".sts.yaml

  source "$BASE_ROOT_DIR"/dev/deps/yq/activate
  source "$cluster_path"/activate

  cd "$BASE_SCRIPT_DIR"/..
  docker/build.sh
  docker/push.sh
  local image_name=$(cat docker/image.txt)
  print_and_exec yq -i \
    '(.spec.template.spec.containers[] | select(.name == "'"$container_name"'")).image = "'"$image_name"'"' "$yaml_path"
  "$cluster_path"/kubectl.sh diff -k "$cluster_path"/yaml/"$namespace" || true
  "$cluster_path"/kubectl.sh apply -k "$cluster_path"/yaml/"$namespace"
  "$cluster_path"/kubectl.sh rollout status -n "$namespace" -w statefulset "$deployment_name"
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../base/main.sh
