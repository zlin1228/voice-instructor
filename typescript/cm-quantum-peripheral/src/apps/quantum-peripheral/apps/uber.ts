import fsPromises from "node:fs/promises"
import { log } from "base-core/lib/logging.js"
import { Scope } from "base-core/lib/scope.js"
import { objectType, stringType } from "base-core/lib/types.js"
import { fileExists, makeTemporaryDirectory } from "base-node/lib/file.js"
import {
  ScreenshotTaker,
  waitUntilPostDone,
  waitUntilPageClose,
  connectToChrome,
} from "base-playwright/lib/playwright.js"
import { LinkResponse } from "cm-quantum-peripheral-common/lib/schema/common.js"
import {
  UberRequestRideRequest,
  UberRequestRideResponse,
  UberRideRequestLink,
} from "cm-quantum-peripheral-common/lib/schema/uber.js"
import { stringRandomFilenameWithTimestamp } from "base-core/lib/string.js"
import { uploadGcsDirectory } from "base-gcp/lib/gcs.js"

// Uber Deep Link Reference:
// https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction

const uberAppId = "UTpury23KgCl8Ow1qbtSci7vAX99j6HA"

export async function buildUberRideRequestLink(
  request: UberRideRequestLink
): Promise<LinkResponse> {
  const params = [
    { name: "action", value: "setPickup" },
    { name: "client_id", value: uberAppId },
    ...(request.pickup === undefined
      ? []
      : [
          {
            name: "pickup[latitude]",
            value: request.pickup.geoLocation.latitude.toString(),
          },
          {
            name: "pickup[longitude]",
            value: request.pickup.geoLocation.longitude.toString(),
          },
          ...(request.pickup.nickname === undefined
            ? []
            : [
                {
                  name: "pickup[nickname]",
                  value: request.pickup.nickname,
                },
              ]),
          ...(request.pickup.formattedAddress === undefined
            ? []
            : [
                {
                  name: "pickup[formatted_address]",
                  value: request.pickup.formattedAddress,
                },
              ]),
        ]),
    {
      name: "dropoff[latitude]",
      value: request.dropoff.geoLocation.latitude.toString(),
    },
    {
      name: "dropoff[longitude]",
      value: request.dropoff.geoLocation.longitude.toString(),
    },
    ...(request.dropoff.nickname === undefined
      ? []
      : [
          {
            name: "dropoff[nickname]",
            value: request.dropoff.nickname,
          },
        ]),
    ...(request.dropoff.formattedAddress === undefined
      ? []
      : [
          {
            name: "dropoff[formatted_address]",
            value: request.dropoff.formattedAddress,
          },
        ]),
  ]

  const p = new URLSearchParams()
  for (const { name, value } of params) {
    p.append(name, value)
  }
  return {
    url: `uber://?${p.toString()}`,
  }
}

export async function uberRequestRide(
  scope: Scope,
  request: UberRequestRideRequest
): Promise<UberRequestRideResponse> {
  const assetName = stringRandomFilenameWithTimestamp()
  const gcsPath = `gs://quantum-workload/scratch/uber-request-ride-assets/${assetName}`
  const { pickupAddress, dropoffAddress } = request
  const localPath = await makeTemporaryDirectory(
    scope,
    "uber-request-ride-assets"
  )
  const screenshotTaker = new ScreenshotTaker(localPath)
  const browserUrl = process.env["CM_CHROME_BROWSER_URL"] ?? "localhost:9222"
  log.info(`Connecting to Chrome [${browserUrl}]`)
  const browser = await connectToChrome(browserUrl)
  try {
    log.info(`Open a new page`)
    const storageState = (await fileExists("quantum-uber-demo/state.json"))
      ? "quantum-uber-demo/state.json"
      : undefined
    const context = await browser.newContext({
      ...(storageState && { storageState }),
      recordVideo: { dir: localPath },
    })
    context.setDefaultTimeout(60000)
    const page = await context.newPage()
    page.setDefaultTimeout(60000)
    // await registerNetworkLogger(scope, page, (url) =>
    //   url.startsWith("https://m.uber.com/go/graphql")
    // )
    // Navigate to the Uber website and log in to your account
    log.info(`Goto https://m.uber.com/looking`)
    await page.goto("https://m.uber.com/looking")
    await screenshotTaker.screenshot(scope, page, "home")
    log.info(`URL: ${page.url()}`)
    if (!page.url().startsWith("https://m.uber.com/")) {
      if (page.url().startsWith("https://auth.uber.com/")) {
        log.info(`Login required due to URL being [${page.url()}]`)
        console.log(
          "Please attach to the headless Chrome and log into the Uber account from a desktop browser"
        )
      }
      await page.waitForURL("https://m.uber.com/**", { timeout: 0 })
      await page.context().storageState({
        path: "quantum-uber-demo/state.json",
      })
      await screenshotTaker.screenshot(scope, page, "login")
    }

    log.info(`Fill pickup location [${pickupAddress}]`)
    const pickupElement = page.getByText("Pickup location")
    await screenshotTaker.screenshot(scope, page, "pickup-0")
    await waitUntilPostDone(
      scope,
      page,
      objectType([
        {
          name: "variables",
          type: objectType([{ name: "query", type: stringType }] as const),
        },
      ] as const),
      async (req) => req.variables.query === pickupAddress
    )(async () => {
      await pickupElement.type(pickupAddress)
      await screenshotTaker.screenshot(scope, page, "pickup-1")
    })
    await screenshotTaker.screenshot(scope, page, "pickup-2")
    await page
      .getByRole("main")
      .getByText(pickupAddress, { exact: true })
      .press("Enter")
    await screenshotTaker.screenshot(scope, page, "pickup-3")

    log.info(`Fill dropoff location [${dropoffAddress}]`)
    const dropoffElement = page.getByText("Dropoff location")
    await screenshotTaker.screenshot(scope, page, "dropoff-0")
    await waitUntilPostDone(
      scope,
      page,
      objectType([
        {
          name: "variables",
          type: objectType([{ name: "query", type: stringType }] as const),
        },
      ] as const),
      async (req) => req.variables.query === dropoffAddress
    )(async () => {
      await dropoffElement.type(dropoffAddress)
      await screenshotTaker.screenshot(scope, page, "dropoff-1")
    })
    await screenshotTaker.screenshot(scope, page, "dropoff-2")
    await page
      .getByRole("main")
      .getByText(dropoffAddress, { exact: true })
      .press("Enter")
    await screenshotTaker.screenshot(scope, page, "dropoff-3")

    log.info(`Click search button`)
    await waitUntilPostDone(
      scope,
      page,
      objectType([{ name: "operationName", type: stringType }] as const),
      async (req) => req.operationName === "Products"
    )(async () => {
      await page.getByRole("button", { name: "Search" }).click()
      await screenshotTaker.screenshot(scope, page, "search")
    })

    await screenshotTaker.screenshot(scope, page, "products")
    log.info(`Click the first product`)
    await page
      .locator("li[data-testid='product_selector.list_item'][role=option]")
      .first()
      .click()
    await screenshotTaker.screenshot(scope, page, "review")

    await page.getByRole("button", { name: "Request ride" }).click()
    await screenshotTaker.screenshot(scope, page, "request")

    log.info("Wait until page close")
    await waitUntilPageClose(scope, page, 3)
    log.info(`Finished`)
    if (!page.isClosed()) {
      await screenshotTaker.screenshot(scope, page, "finish")
    }
    return {
      ok: true,
      logPath: gcsPath,
    }
  } catch (e) {
    log.info(`Failed to request Uber ride due to ${String(e)}`)
    return {
      ok: false,
      logPath: gcsPath,
    }
  } finally {
    await browser.close()
    await uploadGcsDirectory(scope, localPath, gcsPath)
    await fsPromises.rm(localPath, {
      recursive: true,
      force: true,
    })
  }
}
