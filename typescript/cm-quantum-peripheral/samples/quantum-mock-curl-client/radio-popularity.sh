#!/usr/bin/env bash

main() {
  local server_address=${1:-http://localhost:8080}

  print_and_exec curl \
    "$server_address"/quantum-mock/mockRadioPopularityV1?keywords=aaa,bbb,ccc,ddd
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../../base/main.sh
