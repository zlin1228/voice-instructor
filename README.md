
Directory structure:

```
/
└── typescript                         # TypeScript libraries and applications
    ├── base-core                      # Core library for both NodeJS and Web
    ├── base-node                      # Library for NodeJS
    ├── cm-rabbit-common                  # rabbit API schema (cross-platform library)
    ├── cm-rabbit-next                 # rabbit Web App (Next 13 App Router application)
    ├── cm-rabbit-service              # rabbit Service (Node application)
    ├── cm-browsing-minio-common       # Browsing minion schema (cross-platform library)
    ├── cm-browsing-minio-service      # Browsing minion service (Node application)
    ├── cm-quantum-peripheral-common   # Agent API schema (cross-platform library)
    ├── cm-quantum-peripheral          # Agent server (Node application)
    └── common                         # Shared configurations and tools
```

# Development Environment

This repository supports the following environments:

- Ubuntu Server 22.04
- Windows 11 WSL2 with Ubuntu 22.04
- macOS (Apple Silicon)
  - Note: Required GNU Bash and common GNU utilities
  - Note: Applications are compiled to ARM64 natively. Docker images are built for linux-x86_64 (expect low performance).

These VSCode extensions are recommended:

- [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
- [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot)

Environment setup:

- For macOS: Install GNU Bash and utilities

  Install [Brew](https://brew.sh/):

  ```shell
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  ```

  Install GNU utilities:

  ```shell
  export PATH=/opt/homebrew/bin:$PATH
  brew install bash tmux coreutils findutils gnu-tar gnu-sed gawk gnutls gnu-indent gnu-getopt grep gzip
  ```

  Append the following content to `~/.profile`:

  ```bash
  eval "$(/opt/homebrew/bin/brew shellenv)"
  export PATH="/opt/homebrew/opt/coreutils/libexec/gnubin:$PATH"
  export PATH="/opt/homebrew/opt/gnu-tar/libexec/gnubin:$PATH"
  export PATH="/opt/homebrew/opt/gnu-grep/libexec/gnubin:$PATH"
  export PATH="/opt/homebrew/opt/gnu-sed/libexec/gnubin:$PATH"
  export PATH="/opt/homebrew/opt/gawk/libexec/gnubin:$PATH"
  export PATH="/opt/homebrew/opt/findutils/libexec/gnubin:$PATH"
  ```

- Install Docker

  For Windows WSL2 and macOS, install Docker Desktop following the instructions from [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/).

  For Ubuntu Server, install Docker Engine following the instructions from [https://docs.docker.com/engine/install/](https://docs.docker.com/engine/install/).

- Install and configure `gcloud`

  ```shell
  source dev/deps/gcloud/activate
  gcloud auth login --no-launch-browser  # Log in using your Google account
  ```

- Install and configure Docker

  ```shell
  dev/utilities/gcp/configure-docker.sh --quiet
  ```

# Applications / Libraries

## rabbit (service and Web App)

### Install all dependencies

```shell
typescript/common/install-deps.sh
typescript/common/pkg-deps-run.sh cm-rabbit-service local/build.sh
typescript/common/pkg-deps-run.sh cm-rabbit-next local/build.sh
```

### Run locally

The test web application is available at localhost:8080

```shell
# Terminal - Service:
typescript/common/pkg-deps-run.sh cm-rabbit-service local/build.sh  # required only if code outside typescript/cm-rabbit-service is modified.
typescript/cm-rabbit-service/local/test.sh

# Terminal - Web App:
typescript/common/pkg-deps-run.sh cm-rabbit-next local/build.sh  # required only if code outside typescript/cm-rabbit-next is modified.
typescript/cm-rabbit-next/local/run-dev.sh

# Terminal - Kubernetes proxy:
typescript/cm-rabbit-service/k8s/proxy.sh

# Terminal - Milvus proxy:
clusters/quantum-us-west2-230409/kubectl.sh \
  -n milvus \
  port-forward \
  svc/dev-milvus 27017:19530

# Optional - Access the Milvus instance via Attu (Milvus administration web app) at http://localhost:8081.
clusters/quantum-us-west2-230409/kubectl.sh \
  -n milvus \
  port-forward \
  svc/dev-attu 8081:80
```

### Run benchmarks

Clone the evals repository from https://github.com/rabbit-hmi/evals, assuming path is at `${PATH}`.

```shell
cd ${PATH}

# edit line 26 of RabbitCompletionFn to ws://localhost:8080
vim rabbit/rabbit_conversation_fn.py

# run basic conversation benchmarks
EVALS_THREADS=4 PYTHONPATH=. oaieval rabbit_conversation_fn rabbit-basic --registry_path ./rabbit/
```

### Deploy to dev environment (https://dev.os2.ai)

```shell
# Service:
typescript/cm-rabbit-service/k8s/dev-deploy.sh

# Web App:
typescript/cm-rabbit-next/k8s/dev-deploy.sh

# Supervisor:
typescript/cm-rabbit-supervisor/k8s/dev-deploy.sh

# Optional: stream server logs from dev environment:
typescript/cm-rabbit-service/k8s/dev-logs.sh
```

### Promote from dev to staging environment (https://staging.os2.ai):

```shell
# Step 1: Notify others that you are doing so on Slack.

# Step 2: Copy the K8s YAML files from dev to staging, and show the difference between the YAML files and the current K8s objects:
clusters/quantum-us-west2-230409/os2-dev-to-staging.sh
# Manually inspect the diff. Verify that all changes are expected!

# Step 3: Apply the K8s YAML files.
clusters/quantum-us-west2-230409/kubectl.sh apply -k clusters/quantum-us-west2-230409/yaml/os2-staging

# Step 4: Commit all your changes to Git repository.

# Optional: check rollout status
clusters/quantum-us-west2-230409/kubectl.sh -n os2-staging get pods -w

# Optional: stream server logs from staging environment:
typescript/cm-rabbit-service/k8s/staging-logs.sh
```

### Promote from staging to prod environment (https://os2.ai):

```shell
# Step 1: Notify others that you are doing so on Slack.

# Step 2: Copy the K8s YAML files from stagng to prod, and show the difference between the YAML files and the current K8s objects:
clusters/quantum-us-west2-230409/os2-staging-to-prod.sh
# Manually inspect the diff. Verify that all changes are expected!

# Step 3: Apply the K8s YAML files.
clusters/quantum-us-west2-230409/kubectl.sh apply -k clusters/quantum-us-west2-230409/yaml/os2-prod

# Step 4: Commit all your changes to Git repository.

# Optional: check rollout status
clusters/quantum-us-west2-230409/kubectl.sh -n os2-prod get pods -w
```

### Enable/disable unavailable page:

Open the Kubernetes ConfigMap object:

- For dev environment: https://console.cloud.google.com/kubernetes/configmap/us-west2/quantum-us-west2-230409/os2-dev/os2-meta-config/yaml/edit?project=cmc-ai
- For staging environment: https://console.cloud.google.com/kubernetes/configmap/us-west2/quantum-us-west2-230409/os2-staging/os2-meta-config/yaml/edit?project=cmc-ai
- For prod environment: https://console.cloud.google.com/kubernetes/configmap/us-west2/quantum-us-west2-230409/os2-prod/os2-meta-config/yaml/edit?project=cmc-ai

Then change the `serviceUp` field in the content of `meta.json` accordingly. All rabbit web apps will take effect in minutes.

## Cyberpunk

### Install all dependencies

```shell
typescript/common/install-deps.sh
typescript/common/pkg-deps-run.sh cm-cyberpunk-next local/build.sh
```

### Run locally

```shell
typescript/cm-cyberpunk-next/local/run-dev.sh
```

# Run remote browser playground

This instructions are for setting up a simple minion playground and run some code against the browser.

Steps:

- Build the minion Docker image locally.

  ```bash
  typescript/cm-browsing-minion-service/docker/build.sh
  ```

- Run the minion Docker image.

  ```bash
  typescript/cm-browsing-minion-service/docker/run.sh
  ```

- Inspect the containerized browser from your local browser.

  Open your local Chrome browser and navigate to `chrome://inspect`. Click "Configured ..." button and add `localhost:9222`. A few new tabs should show below. Click the "inspect" link for the one of `about:blank`.

  Now you can manually control the containerized browser and use Chrome developer tools as usual.

- Control the containerized browser programmatically.

  Just make a copy of `typescript/cm-rabbit-service/src/playground/test-spotify-browser.ts` and start from there. You mainly control the browser via a [Page](https://playwright.dev/docs/api/class-page) object from Playwright. `typescript/cm-rabbit-service/src/spotify/spotify-client.ts` contains the code for our Spotify agent.
Contribution: 2018-06-25 20:00

Contribution: 2018-06-25 20:01

Contribution: 2018-06-25 20:02

Contribution: 2018-06-26 20:00

Contribution: 2018-06-26 20:01

Contribution: 2018-06-26 20:02

Contribution: 2018-06-28 20:00

Contribution: 2018-06-28 20:01

Contribution: 2018-06-28 20:02

Contribution: 2018-07-05 20:00

Contribution: 2018-07-10 20:00

Contribution: 2018-07-12 20:00

Contribution: 2018-07-12 20:01

Contribution: 2018-07-12 20:02

Contribution: 2018-07-13 20:00

Contribution: 2018-07-13 20:01

Contribution: 2018-07-17 20:00

Contribution: 2018-07-17 20:01

Contribution: 2018-07-17 20:02

Contribution: 2018-07-17 20:03

Contribution: 2018-07-18 20:00

Contribution: 2018-07-18 20:01

Contribution: 2018-07-18 20:02

Contribution: 2018-07-18 20:03

Contribution: 2018-07-20 20:00

Contribution: 2018-07-20 20:01

Contribution: 2018-07-24 20:00

Contribution: 2018-07-24 20:01

Contribution: 2018-07-26 20:00

Contribution: 2018-07-26 20:01

Contribution: 2018-07-26 20:02

Contribution: 2018-07-26 20:03

Contribution: 2018-08-02 20:00

Contribution: 2018-08-02 20:01

Contribution: 2018-08-02 20:02

Contribution: 2018-08-03 20:00

Contribution: 2018-08-08 20:00

Contribution: 2018-08-08 20:01

Contribution: 2018-08-09 20:00

Contribution: 2018-08-09 20:01

Contribution: 2018-08-09 20:02

Contribution: 2018-08-13 20:00

Contribution: 2018-08-14 20:00

Contribution: 2018-08-14 20:01

Contribution: 2018-08-16 20:00

Contribution: 2018-08-16 20:01

Contribution: 2018-08-16 20:02

Contribution: 2018-08-16 20:03

Contribution: 2018-08-17 20:00

Contribution: 2018-08-17 20:01

Contribution: 2018-08-17 20:02

Contribution: 2018-08-20 20:00

Contribution: 2018-08-20 20:01

Contribution: 2018-08-20 20:02

Contribution: 2018-08-21 20:00

Contribution: 2018-08-21 20:01

Contribution: 2018-08-22 20:00

Contribution: 2018-08-22 20:01

Contribution: 2018-08-23 20:00

Contribution: 2018-08-23 20:01

Contribution: 2018-08-23 20:02

Contribution: 2018-08-23 20:03

Contribution: 2018-08-24 20:00

Contribution: 2018-08-28 20:00

Contribution: 2018-08-28 20:01

Contribution: 2018-08-28 20:02

Contribution: 2018-08-28 20:03

Contribution: 2018-08-29 20:00

Contribution: 2018-08-29 20:01

Contribution: 2018-08-29 20:02

Contribution: 2018-08-30 20:00

Contribution: 2018-08-30 20:01

Contribution: 2018-09-04 20:00

Contribution: 2018-09-05 20:00

Contribution: 2018-09-12 20:00

Contribution: 2018-09-12 20:01

Contribution: 2018-09-12 20:02

Contribution: 2018-09-14 20:00

Contribution: 2018-09-14 20:01

Contribution: 2018-09-14 20:02

Contribution: 2018-09-14 20:03

Contribution: 2018-09-17 20:00

Contribution: 2018-09-17 20:01

Contribution: 2018-09-20 20:00

Contribution: 2018-09-20 20:01

Contribution: 2018-09-20 20:02

Contribution: 2018-09-20 20:03

Contribution: 2018-09-24 20:00

Contribution: 2018-09-24 20:01

Contribution: 2018-09-26 20:00

Contribution: 2018-09-26 20:01

Contribution: 2018-09-26 20:02

Contribution: 2018-09-27 20:00

Contribution: 2018-09-27 20:01

Contribution: 2018-09-27 20:02

Contribution: 2018-09-27 20:03

Contribution: 2018-09-28 20:00

Contribution: 2018-09-28 20:01

Contribution: 2018-09-28 20:02

Contribution: 2018-10-01 20:00

Contribution: 2018-10-01 20:01

Contribution: 2018-10-01 20:02

Contribution: 2018-10-03 20:00

Contribution: 2018-10-03 20:01

Contribution: 2018-10-03 20:02

Contribution: 2018-10-03 20:03

Contribution: 2018-10-05 20:00

Contribution: 2018-10-05 20:01

Contribution: 2018-10-08 20:00

Contribution: 2018-10-09 20:00

Contribution: 2018-10-09 20:01

Contribution: 2018-10-09 20:02

Contribution: 2018-10-12 20:00

Contribution: 2018-10-12 20:01

Contribution: 2018-10-12 20:02

Contribution: 2018-10-15 20:00

Contribution: 2018-10-22 20:00

Contribution: 2018-10-22 20:01

Contribution: 2018-10-23 20:00

Contribution: 2018-10-23 20:01

Contribution: 2018-10-23 20:02

Contribution: 2018-10-23 20:03

Contribution: 2018-10-31 20:00

Contribution: 2018-10-31 20:01

Contribution: 2018-10-31 20:02

Contribution: 2018-11-01 20:00

Contribution: 2018-11-02 20:00

Contribution: 2018-11-06 20:00

Contribution: 2018-11-06 20:01

Contribution: 2018-11-06 20:02

Contribution: 2018-11-06 20:03

Contribution: 2018-11-08 20:00

Contribution: 2018-11-09 20:00

Contribution: 2018-11-13 20:00

Contribution: 2018-11-13 20:01

Contribution: 2018-11-14 20:00

Contribution: 2018-11-14 20:01

Contribution: 2018-11-14 20:02

Contribution: 2018-11-26 20:00

Contribution: 2018-11-27 20:00

Contribution: 2018-11-27 20:01

Contribution: 2018-11-27 20:02

Contribution: 2018-11-27 20:03

Contribution: 2018-11-28 20:00

Contribution: 2018-11-28 20:01

Contribution: 2018-11-28 20:02

Contribution: 2018-11-29 20:00

Contribution: 2018-11-29 20:01

Contribution: 2018-11-29 20:02

Contribution: 2018-12-03 20:00

Contribution: 2018-12-03 20:01

Contribution: 2018-12-03 20:02

Contribution: 2018-12-03 20:03

Contribution: 2018-12-05 20:00

Contribution: 2018-12-05 20:01

Contribution: 2018-12-05 20:02

Contribution: 2018-12-06 20:00

Contribution: 2018-12-06 20:01

Contribution: 2018-12-11 20:00

Contribution: 2018-12-11 20:01

Contribution: 2018-12-11 20:02

Contribution: 2018-12-11 20:03

Contribution: 2018-12-12 20:00

Contribution: 2018-12-12 20:01

Contribution: 2018-12-12 20:02

Contribution: 2018-12-13 20:00

Contribution: 2018-12-14 20:00

Contribution: 2018-12-20 20:00

Contribution: 2018-12-24 20:00

Contribution: 2018-12-31 20:00

Contribution: 2018-12-31 20:01

Contribution: 2018-12-31 20:02

Contribution: 2018-12-31 20:03

Contribution: 2019-01-03 20:00

Contribution: 2019-01-03 20:01

Contribution: 2019-01-04 20:00

Contribution: 2019-01-08 20:00

Contribution: 2019-01-08 20:01

Contribution: 2019-01-09 20:00

Contribution: 2019-01-10 20:00

Contribution: 2019-01-16 20:00

Contribution: 2019-01-16 20:01

Contribution: 2019-01-16 20:02

Contribution: 2019-01-17 20:00

Contribution: 2019-01-17 20:01

Contribution: 2019-01-17 20:02

Contribution: 2019-01-18 20:00

Contribution: 2019-01-18 20:01

Contribution: 2019-01-18 20:02

Contribution: 2019-01-18 20:03

Contribution: 2019-01-22 20:00

Contribution: 2019-01-22 20:01

Contribution: 2019-01-23 20:00

Contribution: 2019-01-28 20:00

Contribution: 2019-01-28 20:01

Contribution: 2019-01-31 20:00

Contribution: 2019-02-01 20:00

Contribution: 2019-02-04 20:00

Contribution: 2019-02-04 20:01

Contribution: 2019-02-04 20:02

Contribution: 2019-02-04 20:03

Contribution: 2019-02-06 20:00

Contribution: 2019-02-11 20:00

Contribution: 2019-02-11 20:01

Contribution: 2019-02-11 20:02

Contribution: 2019-02-12 20:00

Contribution: 2019-02-20 20:00

Contribution: 2019-02-20 20:01

Contribution: 2019-02-20 20:02

Contribution: 2019-02-20 20:03

Contribution: 2019-02-22 20:00

Contribution: 2019-02-22 20:01

Contribution: 2019-02-22 20:02

Contribution: 2019-02-22 20:03

Contribution: 2019-02-25 20:00

Contribution: 2019-02-25 20:01

Contribution: 2019-02-27 20:00

Contribution: 2019-02-27 20:01

Contribution: 2019-03-01 20:00

Contribution: 2019-03-13 20:00

Contribution: 2019-03-13 20:01

Contribution: 2019-03-14 20:00

Contribution: 2019-03-18 20:00

Contribution: 2019-03-18 20:01

Contribution: 2019-03-18 20:02

Contribution: 2019-03-20 20:00

Contribution: 2019-03-21 20:00

Contribution: 2019-03-27 20:00

Contribution: 2019-03-27 20:01

Contribution: 2019-03-27 20:02

Contribution: 2019-03-29 20:00

Contribution: 2019-03-29 20:01

Contribution: 2019-04-02 20:00

Contribution: 2019-04-02 20:01

Contribution: 2019-04-03 20:00

Contribution: 2019-04-03 20:01

Contribution: 2019-04-03 20:02

Contribution: 2019-04-03 20:03

Contribution: 2019-04-04 20:00

Contribution: 2019-04-04 20:01

Contribution: 2019-04-04 20:02

Contribution: 2019-04-08 20:00

Contribution: 2019-04-08 20:01

Contribution: 2019-04-08 20:02

Contribution: 2019-04-11 20:00

Contribution: 2019-04-15 20:00

Contribution: 2019-04-15 20:01

Contribution: 2019-04-15 20:02

Contribution: 2019-04-15 20:03

Contribution: 2019-04-17 20:00

Contribution: 2019-04-18 20:00

Contribution: 2019-04-18 20:01

Contribution: 2019-04-18 20:02

Contribution: 2019-04-18 20:03

Contribution: 2019-04-19 20:00

Contribution: 2019-04-19 20:01

Contribution: 2019-04-19 20:02

Contribution: 2019-04-19 20:03

Contribution: 2019-04-23 20:00

Contribution: 2019-04-24 20:00

Contribution: 2019-04-24 20:01

Contribution: 2019-04-25 20:00

Contribution: 2019-04-25 20:01

Contribution: 2019-04-25 20:02

Contribution: 2019-04-25 20:03

Contribution: 2019-04-26 20:00

Contribution: 2019-04-26 20:01

Contribution: 2019-04-26 20:02

Contribution: 2019-04-30 20:00

Contribution: 2019-04-30 20:01

Contribution: 2019-04-30 20:02

Contribution: 2019-04-30 20:03

Contribution: 2019-05-01 20:00

Contribution: 2019-05-01 20:01

Contribution: 2019-05-01 20:02

Contribution: 2019-05-01 20:03

Contribution: 2019-05-06 20:00

Contribution: 2019-05-06 20:01

Contribution: 2019-05-06 20:02

Contribution: 2019-05-06 20:03

Contribution: 2019-05-07 20:00

Contribution: 2019-05-07 20:01

Contribution: 2019-05-08 20:00

Contribution: 2019-05-10 20:00

Contribution: 2019-05-13 20:00

Contribution: 2019-05-13 20:01

Contribution: 2019-05-13 20:02

Contribution: 2019-05-14 20:00

Contribution: 2019-05-14 20:01

Contribution: 2019-05-14 20:02

Contribution: 2019-05-14 20:03

Contribution: 2019-05-16 20:00

Contribution: 2019-05-16 20:01

Contribution: 2019-05-16 20:02

Contribution: 2019-05-16 20:03

Contribution: 2019-05-17 20:00

Contribution: 2019-05-17 20:01

Contribution: 2019-05-17 20:02

Contribution: 2019-05-21 20:00

Contribution: 2019-05-21 20:01

Contribution: 2019-05-21 20:02

Contribution: 2019-05-21 20:03

Contribution: 2019-05-22 20:00

Contribution: 2019-05-22 20:01

Contribution: 2019-05-22 20:02

Contribution: 2019-05-22 20:03

Contribution: 2019-05-23 20:00

Contribution: 2019-05-23 20:01

Contribution: 2019-05-23 20:02

Contribution: 2019-05-23 20:03

Contribution: 2019-05-24 20:00

Contribution: 2019-05-24 20:01

Contribution: 2019-05-27 20:00

Contribution: 2019-05-28 20:00

Contribution: 2019-05-28 20:01

Contribution: 2019-05-29 20:00

Contribution: 2019-05-31 20:00

Contribution: 2019-05-31 20:01

Contribution: 2019-05-31 20:02

Contribution: 2019-05-31 20:03

Contribution: 2019-06-04 20:00

Contribution: 2019-06-05 20:00

Contribution: 2019-06-07 20:00

Contribution: 2019-06-07 20:01

Contribution: 2019-06-07 20:02

Contribution: 2019-06-10 20:00

Contribution: 2019-06-10 20:01

Contribution: 2019-06-13 20:00

Contribution: 2019-06-13 20:01

Contribution: 2019-06-18 20:00

Contribution: 2019-06-18 20:01

Contribution: 2019-06-18 20:02

Contribution: 2019-06-19 20:00

Contribution: 2019-06-20 20:00

Contribution: 2019-06-20 20:01

Contribution: 2019-06-20 20:02

Contribution: 2019-06-20 20:03

Contribution: 2019-06-24 20:00

Contribution: 2019-06-24 20:01

Contribution: 2019-06-25 20:00

Contribution: 2019-06-25 20:01

Contribution: 2019-06-25 20:02

Contribution: 2019-06-25 20:03

Contribution: 2019-06-27 20:00

Contribution: 2019-07-02 20:00

Contribution: 2019-07-02 20:01

Contribution: 2019-07-04 20:00

Contribution: 2019-07-04 20:01

Contribution: 2019-07-05 20:00

Contribution: 2019-07-05 20:01

Contribution: 2019-07-05 20:02

Contribution: 2019-07-10 20:00

Contribution: 2019-07-11 20:00

Contribution: 2019-07-11 20:01

Contribution: 2019-07-11 20:02

Contribution: 2019-07-11 20:03

Contribution: 2019-07-12 20:00

Contribution: 2019-07-17 20:00

Contribution: 2019-07-17 20:01

Contribution: 2019-07-17 20:02

Contribution: 2019-07-17 20:03

Contribution: 2019-07-19 20:00

Contribution: 2019-07-19 20:01

Contribution: 2019-07-19 20:02

Contribution: 2019-07-19 20:03

Contribution: 2019-07-22 20:00

Contribution: 2019-07-23 20:00

Contribution: 2019-07-26 20:00

Contribution: 2019-07-26 20:01

Contribution: 2019-07-26 20:02

Contribution: 2019-07-26 20:03

Contribution: 2019-07-30 20:00

Contribution: 2019-07-30 20:01

Contribution: 2019-07-31 20:00

Contribution: 2019-07-31 20:01

Contribution: 2019-07-31 20:02

Contribution: 2019-08-01 20:00

Contribution: 2019-08-02 20:00

Contribution: 2019-08-02 20:01

Contribution: 2019-08-02 20:02

Contribution: 2019-08-08 20:00

Contribution: 2019-08-08 20:01

Contribution: 2019-08-08 20:02

Contribution: 2019-08-08 20:03

Contribution: 2019-08-12 20:00

Contribution: 2019-08-12 20:01

Contribution: 2019-08-14 20:00

Contribution: 2019-08-16 20:00

Contribution: 2019-08-19 20:00

Contribution: 2019-08-19 20:01

Contribution: 2019-08-19 20:02

Contribution: 2019-08-23 20:00

Contribution: 2019-08-23 20:01

Contribution: 2019-08-26 20:00

Contribution: 2019-08-26 20:01

Contribution: 2019-08-26 20:02

Contribution: 2019-08-29 20:00

Contribution: 2019-09-03 20:00

Contribution: 2019-09-04 20:00

Contribution: 2019-09-04 20:01

Contribution: 2019-09-04 20:02

Contribution: 2019-09-04 20:03

Contribution: 2019-09-05 20:00

Contribution: 2019-09-05 20:01

Contribution: 2019-09-05 20:02

Contribution: 2019-09-05 20:03

Contribution: 2019-09-10 20:00

Contribution: 2019-09-10 20:01

Contribution: 2019-09-17 20:00

Contribution: 2019-09-17 20:01

Contribution: 2019-09-19 20:00

Contribution: 2019-09-19 20:01

Contribution: 2019-09-19 20:02

Contribution: 2019-09-19 20:03

Contribution: 2019-09-20 20:00

Contribution: 2019-09-20 20:01

Contribution: 2019-09-20 20:02

Contribution: 2019-09-20 20:03

Contribution: 2019-09-23 20:00

Contribution: 2019-09-23 20:01

Contribution: 2019-09-25 20:00

Contribution: 2019-09-25 20:01

Contribution: 2019-09-25 20:02

Contribution: 2019-09-25 20:03

Contribution: 2019-09-26 20:00

Contribution: 2019-09-27 20:00

Contribution: 2019-09-30 20:00

Contribution: 2019-10-01 20:00

Contribution: 2019-10-01 20:01

Contribution: 2019-10-02 20:00

Contribution: 2019-10-04 20:00

Contribution: 2019-10-04 20:01

Contribution: 2019-10-04 20:02

Contribution: 2019-10-04 20:03

Contribution: 2019-10-08 20:00

Contribution: 2019-10-08 20:01

Contribution: 2019-10-08 20:02

Contribution: 2019-10-09 20:00

Contribution: 2019-10-09 20:01

Contribution: 2019-10-09 20:02

Contribution: 2019-10-10 20:00

Contribution: 2019-10-10 20:01

Contribution: 2019-10-10 20:02

Contribution: 2019-10-11 20:00

Contribution: 2019-10-11 20:01

Contribution: 2019-10-11 20:02

Contribution: 2019-10-11 20:03

Contribution: 2019-10-14 20:00

Contribution: 2019-10-14 20:01

Contribution: 2019-10-14 20:02

Contribution: 2019-10-14 20:03

Contribution: 2019-10-16 20:00

Contribution: 2019-10-16 20:01

Contribution: 2019-10-18 20:00

Contribution: 2019-10-18 20:01

Contribution: 2019-10-18 20:02

Contribution: 2019-10-18 20:03

Contribution: 2019-10-21 20:00

Contribution: 2019-10-21 20:01

Contribution: 2019-10-22 20:00

Contribution: 2019-10-28 20:00

Contribution: 2019-10-28 20:01

Contribution: 2019-10-28 20:02

Contribution: 2019-10-31 20:00

Contribution: 2019-10-31 20:01

Contribution: 2019-10-31 20:02

Contribution: 2019-11-04 20:00

Contribution: 2019-11-05 20:00

Contribution: 2019-11-05 20:01

Contribution: 2019-11-05 20:02

Contribution: 2019-11-06 20:00

Contribution: 2019-11-06 20:01

Contribution: 2019-11-07 20:00

Contribution: 2019-11-07 20:01

Contribution: 2019-11-07 20:02

Contribution: 2019-11-07 20:03

Contribution: 2019-11-15 20:00

Contribution: 2019-11-15 20:01

Contribution: 2019-11-18 20:00

Contribution: 2019-11-18 20:01

