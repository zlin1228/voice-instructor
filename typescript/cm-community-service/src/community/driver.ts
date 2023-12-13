import { Broadcast, Scope } from "base-core/lib/scope.js"
import {
  CommunityAction,
  CommunityOperation,
  CommunitySnapshot,
} from "cm-community-common/lib/community/types/engine.js"
import { WorldOperationStart } from "cm-community-common/lib/community/types/operation.js"

export class CommunityDriver {
  async run(
    scope: Scope,
    snapshot: CommunitySnapshot,
    worldOperationStart: WorldOperationStart | undefined,
    operationIterable: AsyncIterable<CommunityOperation>,
    emitAction: (action: CommunityAction) => Promise<void>
  ): Promise<void> {}
}
