import stream from "node:stream"
import streamWeb from "node:stream/web"

import ws from "ws"

import fastify, {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify"
import fastifyMetrics from "fastify-metrics"
import fastifySwagger from "@fastify/swagger"
import fastifyMultipart from "@fastify/multipart"

import { CookType, ObjectSpec, ObjectType, Type } from "base-core/lib/types.js"
import {
  CommonClosure,
  commonNormalizer,
  CoreClosure,
} from "base-core/lib/types-common.js"
import {
  ServiceHttpSchema,
  CookServiceHttpSchema,
  RequestHttpSchema,
  QueryHttpSchema,
  ResponseHttpSchema,
  valueToHttpJson,
} from "base-core/lib/http-schema.js"
import { dispatchOneOf, OneOf } from "base-core/lib/one-of.js"
import {
  Scope,
  ScopeAttachment,
  buildAttachmentForCancellation,
  checkAndGetCancelToken,
  launchBackgroundScope,
} from "base-core/lib/scope.js"
import { buildPromise, forceGetProperty } from "base-core/lib/utils.js"
import { makeMaybeOptional } from "base-core/lib/meta.js"
import { throwError } from "base-core/lib/exception.js"
import { Queue } from "base-core/lib/algo/queue.js"
import { log } from "base-core/lib/logging.js"
import { buildAsyncGenerator } from "base-core/lib/processing.js"

export async function createFastifyServer(scope: Scope) {
  const server = fastify({
    logger: { level: "info" },
    trustProxy: true,
    bodyLimit: 1000 * 1000 * 100, // 100MiB
  })
  await server.register(fastifyMetrics, { endpoint: "/metrics" })
  scope.onLeave(async () => {
    // TODO: server.close() hangs. Why?
    void server.close()
  })

  // await server.register(fastifySwagger, {
  //   routePrefix: "/_swagger",
  //   uiConfig: {
  //     docExpansion: "full",
  //     deepLinking: false,
  //   },
  //   exposeRoute: true,
  // })

  // await server.register(fastifyMultipart)
  // await server.register(fastifyCors)

  // server.get("/_debug", (request) => {
  //   return `Debug - ${request.raw.url ?? "(unknown)"} - ${
  //     request.raw.method ?? "(unknown)"
  //   } - ${request.raw.rawHeaders.join("|")}\n`
  // })

  return server
}

interface FastifyHandler {
  request: FastifyRequest
  reply: FastifyReply
}

const fastifyHandlerAttachmentKey = Symbol("FastifyHandler")

export function getFastifyHandlerAttachment(
  scope: Scope | undefined
): FastifyHandler | undefined {
  return scope?.getAttachment(fastifyHandlerAttachmentKey) as
    | FastifyHandler
    | undefined
}

function buildAttachmentForFastifyHandler(
  handler: FastifyHandler
): ScopeAttachment {
  return [fastifyHandlerAttachmentKey, async (scope) => handler]
}

export async function extractQuery<Spec extends ObjectSpec<CoreClosure>>(
  schema: QueryHttpSchema<Spec>,
  request: FastifyRequest
): Promise<CookType<ObjectType<CommonClosure, Spec>>> {
  const value = request.query
  if (typeof value !== "object" || value === null) {
    throw new Error("query is not valid")
  }
  return schema.constructObject((field) => {
    const x = forceGetProperty(value, field.name)
    return makeMaybeOptional(
      field.optional,
      () => (x === undefined ? undefined : commonNormalizer(field.type, x)),
      () => commonNormalizer(field.type, x)
    )
  })
}

async function extractRequest(
  schema: RequestHttpSchema,
  request: FastifyRequest
): Promise<unknown> {
  return dispatchOneOf(schema, {
    empty: async () => undefined,
    bytes: async () =>
      await (
        (await request.file()) ?? throwError("Bytes not available")
      ).toBuffer(),
    stream: async () =>
      stream.Readable.toWeb(
        ((await request.file()) ?? throwError("Bytes not available")).file
      ),
    json: async (type) => commonNormalizer(type, request.body),
  })
}

async function buildFastifyResponse(
  schema: ResponseHttpSchema,
  value: unknown
): Promise<unknown> {
  return dispatchOneOf(schema, {
    empty: async () => undefined,
    bytes: async () => Buffer.from(value as Uint8Array),
    stream: async () =>
      stream.Readable.fromWeb(value as streamWeb.ReadableStream),
    json: async (type) => valueToHttpJson(type, value),
  })
}

export async function createFastifyPluginFromService<
  S extends ServiceHttpSchema
>(
  scope: Scope,
  schema: S,
  service: CookServiceHttpSchema<S>
): Promise<FastifyPluginAsync> {
  return async (fastify, options) => {
    for (const method of schema) {
      fastify.route({
        method: dispatchOneOf(method, {
          get: () => "GET",
          post: () => "POST",
          put: () => "PUT",
        }),
        url: `/${method.value.name}`,
        handler: async (request, reply) => {
          return await dispatchOneOf(method, {
            get: async (getMethod) => {
              return await Scope.with(
                scope,
                [
                  buildAttachmentForFastifyHandler({
                    request,
                    reply,
                  }),
                ],
                async (scope) => {
                  return await buildFastifyResponse(
                    getMethod.response,
                    await (service as any)[`get_${getMethod.name}`](
                      scope,
                      await extractQuery(getMethod.query, request)
                    )
                  )
                }
              )
            },
            post: async (postMethod) => {
              return await Scope.with(
                scope,
                [
                  buildAttachmentForFastifyHandler({
                    request,
                    reply,
                  }),
                ],
                async (scope) => {
                  return await buildFastifyResponse(
                    postMethod.response,
                    await (service as any)[`post_${postMethod.name}`](
                      scope,
                      await extractRequest(postMethod.request, request)
                    )
                  )
                }
              )
            },
            put: async (putMethod) => {
              return await Scope.with(
                scope,
                [
                  buildAttachmentForFastifyHandler({
                    request,
                    reply,
                  }),
                ],
                async (scope) => {
                  return await buildFastifyResponse(
                    putMethod.response,
                    await (service as any)[`put_${putMethod.name}`](
                      scope,
                      await extractRequest(putMethod.request, request)
                    )
                  )
                }
              )
            },
          })
        },
      })
    }
  }
}

export async function handleWebSocket<ClientMessageT, ServerMessageT>(
  scope: Scope,
  webSocket: ws.WebSocket,
  clientMessageType: Type<CommonClosure, ClientMessageT>,
  serverMessageType: Type<CommonClosure, ServerMessageT>,
  body: (
    scope: Scope,
    clientMessageIter: AsyncIterable<
      OneOf<{ json: ClientMessageT; binary: Uint8Array }>
    >
  ) => AsyncIterable<OneOf<{ json: ServerMessageT; binary: Uint8Array }>>
): Promise<void> {
  const { cancel, attachment } = buildAttachmentForCancellation(true)
  return Scope.with(scope, [attachment], async (scope) => {
    scope.onLeave(async () => {
      log.info("WebSocket scope left")
    })
    const cancelToken = checkAndGetCancelToken(scope)
    cancelToken.onCancel(async () => {
      log.info("WebSocket scope canceled")
    })

    const queue = new Queue<
      OneOf<{ json: ClientMessageT; binary: Uint8Array }>
    >()
    let valueResolve: (() => void) | undefined = undefined
    let disconnected = false
    webSocket.on("message", (data, isBinary) => {
      // TODO: Check queue size before pushing the message.
      // If the queue is too large, we should close the connection.
      if (isBinary) {
        queue.pushBack({
          kind: "binary",
          value: data as Uint8Array,
        })
      } else {
        queue.pushBack({
          kind: "json",
          value: commonNormalizer(clientMessageType, data.toString()),
        })
      }
      if (valueResolve !== undefined) {
        valueResolve()
        valueResolve = undefined
      }
    })
    webSocket.once("close", (code, reason) => {
      log.info(`WebSocket closed due to [${code}]`)
      disconnected = true
      if (valueResolve !== undefined) {
        valueResolve()
        valueResolve = undefined
      }
      cancel(new Error(`WebSocket closed due to [${code}]`))
    })
    webSocket.once("error", (err) => {
      log.info(`WebSocket encounted an error [${String(err)}]`)
      disconnected = true
      if (valueResolve !== undefined) {
        valueResolve()
        valueResolve = undefined
      }
      cancel(new Error("WebSocket ecountered an error", { cause: err }))
    })

    const clientMessageIter = (async function* () {
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

    for await (const serverMessage of body(scope, clientMessageIter)) {
      if (disconnected) continue
      if (serverMessage.kind === "json") {
        await new Promise<void>((resolve, reject) => {
          try {
            webSocket.send(
              JSON.stringify(
                commonNormalizer(serverMessageType, serverMessage.value)
              ),
              { binary: false },
              (err) => {
                if (err === undefined || err === null) resolve()
                else reject(err)
              }
            )
            log.info(
              `Sent websocket message: ${JSON.stringify(serverMessage.value)}`
            )
          } catch (e) {
            log.info(`Failed to send WebSocket JSON message: [${String(e)}]`)
            console.log(serverMessage.value)
            reject(e)
          }
        })
      } else {
        await new Promise<void>((resolve, reject) => {
          try {
            webSocket.send(serverMessage.value, { binary: true }, (err) => {
              if (err === undefined || err === null) resolve()
              else reject(err)
            })
          } catch (e) {
            log.info(`Failed to send WebSocket binary message: [${String(e)}]`)
            console.log(`Length: ${serverMessage.value.byteLength}`)
            reject(e)
          }
        })
      }
    }
  })
}

export async function buildWebSocketStreams<ReqT, RespT, R = void>(
  scope: Scope,
  webSocket: ws.WebSocket,
  requestType: Type<CommonClosure, ReqT>,
  responseType: Type<CommonClosure, RespT>,
  responseIter: AsyncIterable<OneOf<{ json: RespT; binary: Uint8Array }>>,
  body: (
    scope: Scope,
    requestIter: AsyncIterable<OneOf<{ json: ReqT; binary: Uint8Array }>>
  ) => Promise<R>
): Promise<R> {
  const queue = new Queue<OneOf<{ json: ReqT; binary: Uint8Array }>>()
  let valueResolve: (() => void) | undefined = undefined
  let finished = false
  webSocket.on("message", (data, isBinary) => {
    if (isBinary) {
      queue.pushBack({
        kind: "binary",
        value: data as Uint8Array,
      })
    } else {
      queue.pushBack({
        kind: "json",
        value: commonNormalizer(requestType, data.toString()),
      })
    }
    if (valueResolve !== undefined) {
      valueResolve()
      valueResolve = undefined
    }
  })
  webSocket.once("close", (code, reason) => {
    log.info(`WebSocket closed due to [${code}]`)
    finished = true
    if (valueResolve !== undefined) {
      valueResolve()
      valueResolve = undefined
    }
  })
  webSocket.once("error", (err) => {
    log.info(`WebSocket encounted an error [${String(err)}]`)
    finished = true
    if (valueResolve !== undefined) {
      valueResolve()
      valueResolve = undefined
    }
  })

  const requestIter = (async function* () {
    for (;;) {
      for (;;) {
        const value = queue.popFront()
        if (value !== undefined) {
          yield value
        } else {
          break
        }
      }
      if (finished) break
      const { promise, resolve } = buildPromise()
      valueResolve = resolve
      await promise
    }
  })()
  return Scope.with(scope, [], async (scope) => {
    scope.onLeave(async () => {
      log.info("WebSocket scope left")
    })
    launchBackgroundScope(scope, async (scope) => {
      const iter = responseIter[Symbol.asyncIterator]()
      try {
        for (;;) {
          const { done, value } = await iter.next()
          if (done) break
          if (value.kind === "json") {
            await new Promise<void>((resolve, reject) => {
              try {
                webSocket.send(
                  JSON.stringify(commonNormalizer(responseType, value.value)),
                  { binary: false },
                  (err) => {
                    if (err === undefined || err === null) resolve()
                    else reject(err)
                  }
                )
              } catch (e) {
                reject(e)
              }
            })
          } else {
            await new Promise<void>((resolve, reject) => {
              try {
                webSocket.send(value.value, { binary: true }, (err) => {
                  if (err === undefined || err === null) resolve()
                  else reject(err)
                })
              } catch (e) {
                reject(e)
              }
            })
          }
        }
      } catch (e) {
        log.info(`Failed to send WebSocket message: [${String(e)}]`)
        try {
          // This will throw the same exception again. Why??
          await iter.throw?.(e)
        } catch (ee) {
          // do nothing
        }
      }
    })
    return await body(scope, requestIter)
  })
}
