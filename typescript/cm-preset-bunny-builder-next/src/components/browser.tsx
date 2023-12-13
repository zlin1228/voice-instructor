import { withGlobalService } from "@/client-service"
import { connectWebSocket } from "@/websocket"
import { throwError } from "base-core/lib/exception"
import {
  checkAndGetCancelToken,
  BroadcastController,
  launchBackgroundScope,
  Broadcast,
  checkAndGetAbortSignal,
} from "base-core/lib/scope"
import { emptyObjectType } from "base-core/lib/types"
import {
  CookHttpServiceClient,
  buildHttpServiceClient,
  defaultBuildHttpServiceClientOptions,
} from "base-node/lib/service"
import {
  TreeNodeLocation,
  treeNodeLocationType,
  Tree,
} from "cm-bunny-host-common/lib/tree/tree"
import { PageExecutor } from "cm-bunny-host-web-common/lib/action/page-action"
import { WebExecutor } from "cm-bunny-host-web-common/lib/action/web-action"
import { bunnyHostWebHttpServiceSchema } from "cm-bunny-host-web-common/lib/service/schema"
import { useRef, useState, useEffect } from "react"
import { NoVncPanel } from "./novnc"
import { TreeInteractionMode } from "cm-bunny-host-common/lib/tree/tree-interaction"

export type BunnyHostWebClient = CookHttpServiceClient<
  typeof bunnyHostWebHttpServiceSchema
>

function buildWebExecutorFromBunnyHostWebClient(
  bunnyHostWebClient: BunnyHostWebClient,
  selectedNodeBroadcast: Broadcast<TreeNodeLocation>
): WebExecutor {
  return new WebExecutor(async (scope, request) => {
    return await bunnyHostWebClient.post_webAction.fetch(
      request,
      checkAndGetAbortSignal(scope)
    )
  }, selectedNodeBroadcast)
}

export function Browser(props: {
  url: string
  viewOnly: boolean
  interactionMode: TreeInteractionMode
  stateJson: string | undefined
  onPageExecutorReady: (
    webExecutor: WebExecutor,
    pageExecutor: PageExecutor,
    bunnyHostWebClient: BunnyHostWebClient
  ) => void
  onNodeSelected: (tree: Tree, selectedNode: TreeNodeLocation) => void
}) {
  const webExecutorRef = useRef<WebExecutor>()
  const pageExecutorRef = useRef<PageExecutor>()
  const [noVncUrl, setNoVncUrl] = useState<string>()
  const setInteractionModeRef =
    useRef<(interactionMode: TreeInteractionMode) => Promise<void>>()
  useEffect(
    () =>
      withGlobalService(async (scope, clientService) => {
        const cancelToken = checkAndGetCancelToken(scope)
        cancelToken.onCancel(async (error) => {
          console.log("cancelToken.onCancel", error)
        })
        await clientService.connectHostControl(
          scope,
          {},
          async (scope, hostControlServerIter, hostControlClientQueue) => {
            for await (const hostControlServer of hostControlServerIter) {
              if (hostControlServer.kind !== "json") continue
              console.log("hostControlServer", hostControlServer)
              const { bunnyHostWebReady } = hostControlServer.value
              if (bunnyHostWebReady !== undefined) {
                const selectedNodeBroadcast =
                  new BroadcastController<TreeNodeLocation>()
                setNoVncUrl(bunnyHostWebReady.noVncUrl)
                launchBackgroundScope(scope, async (scope) => {
                  await connectWebSocket(
                    scope,
                    `${bunnyHostWebReady.serviceUrl}/selectedNode`,
                    emptyObjectType,
                    treeNodeLocationType,
                    false,
                    async (scope, selectedNodeIter) => {
                      for await (const selectedNode of selectedNodeIter) {
                        if (selectedNode.kind !== "json") continue
                        selectedNodeBroadcast.emit(selectedNode.value)
                      }
                    }
                  )
                })
                const bunnyHostWebClient = buildHttpServiceClient(
                  bunnyHostWebHttpServiceSchema,
                  defaultBuildHttpServiceClientOptions(
                    `${bunnyHostWebReady.serviceUrl}/apis`
                  )
                )
                webExecutorRef.current = buildWebExecutorFromBunnyHostWebClient(
                  bunnyHostWebClient,
                  selectedNodeBroadcast
                )
                const { contexts } = await webExecutorRef.current.listContexts(
                  scope
                )
                const contextId =
                  contexts[0].contextId ?? throwError("Invalid context")
                const pageId =
                  contexts[0].pageIds[0] ?? throwError("Invalid context")
                const pageExecutor =
                  webExecutorRef.current.buildPageExecutor(pageId)
                pageExecutorRef.current = pageExecutor
                if (props.stateJson !== undefined) {
                  await webExecutorRef.current.importContextState(
                    scope,
                    contextId,
                    props.stateJson
                  )
                }
                await webExecutorRef.current
                  .buildPageExecutor(pageId)
                  .navigate(scope, props.url)
                setInteractionModeRef.current = async (interactionMode) => {
                  await webExecutorRef.current?.setPageInteractionMode(
                    scope,
                    contextId,
                    pageId,
                    interactionMode
                  )
                }
                await setInteractionModeRef.current(props.interactionMode)
                webExecutorRef.current.selectedNodeBroadcast.listen(
                  scope,
                  (selectedNode) => {
                    launchBackgroundScope(scope, async (scope) => {
                      const tree = await pageExecutor
                        .buildTreeExecutor()
                        .fetchTree(scope)
                      props.onNodeSelected(tree, selectedNode)
                    })
                  }
                )
                props.onPageExecutorReady(
                  webExecutorRef.current,
                  pageExecutor,
                  bunnyHostWebClient
                )
              }
            }
          }
        )
      }),
    [webExecutorRef]
  )
  useEffect(() => {
    if (props.interactionMode.highlight === undefined) {
      return
    }
    void setInteractionModeRef.current?.(props.interactionMode)
  }, [props.interactionMode.highlight])
  return (
    <div
      style={{
        width: "1024px",
        height: "1024px",
        minWidth: "1024px",
        minHeight: "1024px",
        maxWidth: "1024px",
        maxHeight: "1024px",
        borderStyle: "inset",
        borderColor: props.viewOnly ? "yellow" : "grey",
        borderWidth: "2px",
        boxSizing: "content-box",
        overflow: "hidden",
        pointerEvents: props.viewOnly ? "none" : "auto",
      }}
    >
      {noVncUrl && <NoVncPanel noVncUrl={noVncUrl} />}
    </div>
  )
}
