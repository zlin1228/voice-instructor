import { Page, BrowserContext, chromium } from "playwright"

import { Scope, sleepSeconds } from "base-core/lib/scope.js"
import { fileExists, readTextFile, writeTextFile } from "base-node/lib/file.js"
import { log } from "base-core/lib/logging.js"
import { asInstanceOrAbort } from "base-core/lib/debug.js"

export interface Os2TestOptions {
  url: string
  username: string
  password: string
  videoDir: string
}

export async function clickButtonByName(
  scope: Scope,
  page: Page,
  buttonName: string
): Promise<void> {
  await page
    .getByRole("button", { name: buttonName, exact: true })
    .evaluate((el: HTMLButtonElement) => el.click())
}

async function testOs2Chat(
  scope: Scope,
  page: Page,
  request: string,
  responseRegex: RegExp
): Promise<void> {
  log.info(`Send user request: [${request}]`)
  await page.getByRole("textbox", { name: "user request" }).type(request)
  await page.getByRole("textbox", { name: "user request" }).press("Enter")
  log.info(`Wait for assistant response: [${String(responseRegex)}]`)
  await page
    .getByRole("alert", { name: "assistant response" })
    .getByText(responseRegex)
    .waitFor({ timeout: 50 * 1000 })
  log.info(`Sleep for 45 seconds`)
  await sleepSeconds(scope, 45)
}

const chatTests: [string, RegExp][] = [
  [
    "Clear conversation history.",
    /(?=.*clear|Clear|Done|done|delete|Delete|erase|Erase|over)(?!.*\bsorry\b).*/,
  ],
  // ["Call me Alex.", /\bAlex\b/],
  ["I want to call you Lucy.", /\bLucy\b/],
  ["What is the sum of 12345 and 54321?", /66,?666/],
  [
    "What's the weather in New York?",
    /^(?!.*sorry).*((emperature|weather).*(c|f|C|F|degree)|(c|f|C|F|degree).*(emperature|weather)).*$/,
  ],
  ["What's the current stock price of Amazon?", /(\$|US|dollars|\$|bucks)/],
  ["What's the latest movie by Chistopher Nolan?", /\bOppenheimer\b/],
  // ["When was Vision Pro announced?", /June 5, 2023/],
]

export async function testOs2(
  scope: Scope,
  options: Os2TestOptions
): Promise<Error | undefined> {
  // const browser = await connectToChrome(scope, "localhost:9222")
  // const page = abortIfUndefined(browser.contexts()[0]?.pages()[0])
  // await page.goto("about:blank")
  // await page.context().clearCookies()
  try {
    return await Scope.with(scope, [], async (scope) => {
      log.info(`Launching Chrome browser`)
      const browser = await chromium.launch({
        channel: "chrome",
        headless: false,
        args: [
          "--window-size 1920,1080"
        ]
      })
      scope.onLeave(async () => browser.close())
      const context = await browser.newContext({
        recordVideo: {
          dir: options.videoDir,
        },
      })
      const page = await context.newPage()
      log.info(`Go to rabbit website: [${options.url}]`)
      await page.goto(options.url)
      // log.info(`Click button "agree and continue"`)
      // await clickButtonByName(scope, page, "agree and continue")
      log.info(`Fill email address`)
      try {
        await page
          .getByLabel("Email address")
          .type(options.username, { delay: 100 })
      } catch (e) {
        log.info("Failed to fill Email address!")
        await sleepSeconds(scope, 5) // Ensure that the video shows the last frame
        return undefined
      }
      log.info(`Click button "Continue"`)
      await clickButtonByName(scope, page, "Continue")
      log.info(`Sleep for 2 seconds`)
      await sleepSeconds(scope, 2)
      log.info(`Fill password`)
      await page
        .getByLabel("Password", { exact: true })
        .type(options.password, { delay: 100 })
      log.info(`Click button "Continue"`)
      await clickButtonByName(scope, page, "Continue")
      log.info(`Click button "textmode"`)
      await clickButtonByName(scope, page, "textmode")
      log.info(`Wait for greeting`)
      await page
        .getByRole("alert", { name: "assistant response" })
        .getByText(/([^\s])/)
        .waitFor()
      log.info(`Sleep for 45 seconds`)
      await sleepSeconds(scope, 45)
      for (const chatTest of chatTests) {
        await testOs2Chat(scope, page, chatTest[0], chatTest[1])
      }
      log.info(`Trigger Spotify Player`)
      await testOs2Chat(scope, page, "Play Hotel California", /.*/)
      log.info(`Wait for Spotify Login`)
      await page.getByRole("region", { name: "Spotify Login" }).waitFor()
      log.info(`Finish testing rabbit web`)
      await sleepSeconds(scope, 5) // Ensure that the video shows the last frame
      return undefined
    })
  } catch (error) {
    await sleepSeconds(scope, 5) // Ensure that the video shows the last frame
    return asInstanceOrAbort(Error, error)
  }
}
