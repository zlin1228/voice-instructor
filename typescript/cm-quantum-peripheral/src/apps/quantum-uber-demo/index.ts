import { chromium } from "playwright"
import { log } from "base-core/lib/logging.js"
import {
  ScreenshotTaker,
  waitUntilPageClose,
  waitUntilPostDone,
} from "base-playwright/lib/playwright.js"
import { Scope } from "base-core/lib/scope.js"
import { fileExists } from "base-node/lib/file.js"
import { objectType, stringType } from "base-core/lib/types.js"

// Things to improve:
//   * Handle unavailable products (no nearby drivers)
//   * Handle unavailable service (e.g. too long)
//   * Handle pickup points (e.g. Airport)
//   * Check option confidence (pudoAutoComplete)
//   * Handle payment options

export async function uberDemo(
  scope: Scope,
  pickupAddress: string,
  dropoffAddress: string,
  dryrun: boolean
) {
  const screenshotTaker = new ScreenshotTaker("quantum-uber-demo/assets")
  const browserUrl =
    process.env["CM_CHROME_BROWSER_URL"] ?? "http://localhost:9222"
  log.info(`Connecting to Chrome [${browserUrl}]`)
  const browser = await chromium.connectOverCDP(browserUrl, { timeout: 60000 })
  log.info(`Open a new page`)
  const storageState = (await fileExists("quantum-uber-demo/state.json"))
    ? "quantum-uber-demo/state.json"
    : undefined
  const context = await browser.newContext({
    ...(storageState && { storageState }),
    recordVideo: { dir: "quantum-uber-demo/assets" },
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

  if (!dryrun) {
    await page.getByRole("button", { name: "Request ride" }).click()
    await screenshotTaker.screenshot(scope, page, "request")
  }

  log.info("Wait until page close")
  await waitUntilPageClose(scope, page, 3)
  log.info(`Finished`)
  if (!page.isClosed()) {
    await screenshotTaker.screenshot(scope, page, "finish")
  }
  await browser.close()
}

export async function spotifyDemo(
  scope: Scope,
  pickupAddress: string,
  dropoffAddress: string,
  dryrun: boolean
) {
  const browserUrl =
    process.env["CM_CHROME_BROWSER_URL"] ?? "http://localhost:9222"
  log.info(`Connecting to Chrome [${browserUrl}]`)
  // const browser = await chromium.connectOverCDP(browserUrl, { timeout: 60000 })
  const browser = await chromium.connect(
    "ws://127.0.0.1:9222/devtools/browser/cee871a5-ed9d-438d-8023-74e2488a7013",
    { timeout: 60000 }
  )
  log.info(`Open a new page`)
  const storageState = (await fileExists("spotify/state.json"))
    ? "spotify/state.json"
    : undefined
  const context = await browser.newContext({
    ...(storageState && { storageState }),
  })
  context.setDefaultTimeout(60000)
  const page = await context.newPage()
  page.setDefaultTimeout(60000)
  await page.goto("https://m.uber.com/looking")
  await waitUntilPageClose(scope, page, 3000)
  await context.storageState({ path: "spotify/state.json" })
  await browser.close()
}

async function main() {
  await Scope.with(undefined, [], async (scope) => {
    // const pickupAddress = "5 Wrangler Ln, Bell Canyon, CA 91307"
    // const dropoffAddress = "7234 Canoga Ave, Canoga Park, CA 91303"
    const pickupAddress = "Catch Me Sushi"
    const dropoffAddress = "5 Wrangler Ln, Bell Canyon, CA 91307"
    await spotifyDemo(scope, pickupAddress, dropoffAddress, false)
  })
}
void main()
