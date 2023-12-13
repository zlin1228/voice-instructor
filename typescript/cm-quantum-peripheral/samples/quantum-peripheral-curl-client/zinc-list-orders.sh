#!/usr/bin/env bash

main() {
  print_and_exec curl \
    'https://api.zinc.io/v1/orders?limit=5000&retailer=amazon' \
    -u '627419F764B1A028C5316403:'
}

source "$(dirname "$(realpath "${BASH_SOURCE[0]}")")"/../../../../base/main.sh
