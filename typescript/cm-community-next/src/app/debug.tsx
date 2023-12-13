"use client"
import { useState } from "react"

import { checkAndGetAbortSignal } from "base-core/lib/scope.js"
import { withGlobalService } from "../client-service"
import { WithId } from "cm-community-common/lib/schema/common.js"
import { World } from "cm-community-common/lib/schema/lightspeed.js"

export function DebugPanel(props: {}) {
  const [worlds, setWorlds] = useState<readonly WithId<World>[]>()
  const handleListWorldsClick = () => {
    withGlobalService(async (scope, clientService) => {
      setWorlds(
        await clientService
          .getLightspeedClient()
          .get_listWorlds.fetch({}, checkAndGetAbortSignal(scope))
      )
    })
  }
  return (
    <div>
      <button onClick={handleListWorldsClick}>Run listWorlds</button>
      <div>
        <pre>{JSON.stringify(worlds, null, 2)}</pre>
      </div>
    </div>
  )
}
