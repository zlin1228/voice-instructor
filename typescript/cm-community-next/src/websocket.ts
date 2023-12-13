"use client"

import { HandlingQueue, checkAndGetCancelToken } from "base-core/lib/scope.js"
import { Scope } from "base-core/lib/scope.js"
import { buildPromise } from "base-core/lib/utils.js"
import { buildAttachmentForCancellation } from "base-core/lib/scope.js"
import { CommonClosure, commonNormalizer } from "base-core/lib/types-common.js"
import { resolveUrl } from "base-core/lib/web.js"
import { stringRemovePrefix } from "base-core/lib/string.js"
import { log } from "base-core/lib/logging.js"
import { Queue } from "base-core/lib/algo/queue.js"
import { OneOf } from "base-core/lib/one-of.js"
import { Type } from "base-core/lib/types.js"

export async function connectWebSocket<ClientMessageT, ServerMessageT>(
  scope: Scope,
  webSocketAddress: string,
  clientMessageType: Type<CommonClosure, ClientMessageT>,
  serverMessageType: Type<CommonClosure, ServerMessageT>,
  enableBinaryMessageLogging: boolean,
  body: (
    scope: Scope,
    serverMessageIter: AsyncIterable<
      OneOf<{ json: ServerMessageT; binary: Uint8Array }>
    >,
    clientMessageQueue: HandlingQueue<
      OneOf<{ json: ClientMessageT; binary: Uint8Array | Blob }>
    >
  ) => Promise<void>
): Promise<void> {
  const webSocketUrl = (() => {
    const httpUrl = resolveUrl(window.location.href, webSocketAddress)
    const s1 = stringRemovePrefix(httpUrl, "http://")
    if (s1 !== undefined) {
      return `ws://${s1}`
    }
    const s2 = stringRemovePrefix(httpUrl, "https://")
    if (s2 !== undefined) {
      return `wss://${s2}`
    }
    return httpUrl
  })()
  const { cancel, attachment } = buildAttachmentForCancellation(true)
  await Scope.with(scope, [attachment], async (scope) => {
    scope.onLeave(async () => {
      log.info("WebSocket scope left")
    })
    const webSocket = new WebSocket(webSocketUrl)
    webSocket.binaryType = "arraybuffer"

    const { promise, resolve } = buildPromise()
    webSocket.addEventListener("open", (event) => resolve())

    const queue = new Queue<
      OneOf<{ json: ServerMessageT; binary: Uint8Array }>
    >()
    let valueResolve: (() => void) | undefined = undefined
    let disconnected = false
    webSocket.addEventListener("close", (event) => {
      log.info("WebSocket closed")
      disconnected = true
      if (valueResolve !== undefined) {
        valueResolve()
        valueResolve = undefined
      }
      cancel(new Error("WebSocket closed"))
    })
    webSocket.addEventListener("error", (event) => {
      log.info("WebSocket encountered an error")
      console.log(event)
      disconnected = true
      if (valueResolve !== undefined) {
        valueResolve()
        valueResolve = undefined
      }
      cancel(new Error("WebSocket encountered an error"))
    })
    const cancelToken = checkAndGetCancelToken(scope)
    cancelToken.onCancel(async (reason) => {
      webSocket.close()
    })

    webSocket.addEventListener("message", (ev) => {
      // TODO: Check queue size before pushing the message.
      // If the queue is too large, we should close the connection.
      if (typeof ev.data === "string") {
        log.info(`Received server JSON message: ${ev.data}`)
        queue.pushBack({
          kind: "json",
          value: commonNormalizer(serverMessageType, JSON.parse(ev.data)),
        })
      } else {
        const arrayBuffer = ev.data as ArrayBuffer
        if (enableBinaryMessageLogging) {
          log.info(`Received server binary message: ${arrayBuffer.byteLength}`)
        }
        queue.pushBack({
          kind: "binary",
          value: new Uint8Array(arrayBuffer),
        })
      }
      if (valueResolve !== undefined) {
        valueResolve()
        valueResolve = undefined
      }
    })

    log.info("Connecting WebSocket ...")
    await promise

    log.info("WebSocket connected")
    scope.onLeave(async () => {
      if (webSocket.readyState === WebSocket.OPEN) {
        webSocket.close()
      }
    })

    const serverMessageIter = (async function* () {
      for (;;) {
        for (;;) {
          const value = queue.popFront()
          if (value !== undefined) {
            yield value
          } else {
            break
          }
        }
        if (disconnected) break
        const { promise, resolve } = buildPromise()
        valueResolve = resolve
        await promise
      }
    })()

    const clientMessageQueue = new HandlingQueue<
      OneOf<{
        json: ClientMessageT
        binary: Uint8Array | Blob
      }>
    >(scope, async (scope, clientMessage) => {
      if (clientMessage.kind === "json") {
        log.info(
          `Sending client JSON message: ${JSON.stringify(clientMessage)}`
        )
        webSocket.send(
          JSON.stringify(
            commonNormalizer(clientMessageType, clientMessage.value)
          )
        )
      } else {
        if (enableBinaryMessageLogging) {
          log.info(`Sending client binary message: ${clientMessage.value}`)
        }
        webSocket.send(clientMessage.value)
      }
    })
    await body(scope, serverMessageIter, clientMessageQueue)
  })
}
