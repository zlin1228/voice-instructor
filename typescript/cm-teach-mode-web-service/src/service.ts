import {
  BroadcastController,
  Scope,
  launchBackgroundScope,
} from "base-core/lib/scope.js"

import { TeachModeWebHttpService } from "cm-teach-mode-web-common/lib/schema/schema.js"

export interface TeachModeWebService extends TeachModeWebHttpService {}

export async function buildTeachModeWebService(
  scope: Scope
): Promise<TeachModeWebService> {
  return {
    post_test: async (scope, request) => {
      return {}
    },
  }
}
