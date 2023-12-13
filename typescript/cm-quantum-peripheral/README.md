# Quantum Peripheral

## Quick Start

Run the server locally:

```bash
./run-docker-image.sh
```

Send a sample request:

```bash
curl \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"dropoff":{"geoLocation":{"latitude":37.802374,"longitude":-122.418028},"nickname":"Coit Tower"}}' \
    http://localhost:8080/quantum-peripheral/buildUberRideRequestLink
```

Check the API schema:

See [./src/apps/quantum-peripheral/apis/schema.ts](./src/apps/quantum-peripheral/apis/schema.ts).

## Important Scripts

For deployment:

- `./build-docker-image.sh`: Build the Docker image without pushing to remote registry
- `./run-docker-image.sh`: Run the Docker image locally

For local development:

- `./install-deps.sh`: Install all dependencies
- `./build.sh`: Generate JavaScript files from TypeScript
- `./run.sh`: Run the server
- `./build-python-types.sh`: Print Python Pydantic models for API types

## Uber Demo

Quick start:

- Run `../../layers/playwright/docker-build.sh` to build a Docker image with Chromium installed.
- Run `./docker-run-chrome.sh` to run the above Docker image.
- Run `../../dev/deps/node/build.sh` to install NodeJS.
- Run `./install-deps.sh` to install NPM dependencies.
- Run `./build.sh` to compile TypeScript into JavaScript.
- Run `./run-uber-demo.sh` to launch the Uber demo. The output assets (screenshots and videos) are placed under `./wd/quantum-uber-demo/assets`.

The main source code for the demo is `./src/apps/quantum-uber-demo/index.ts`.
