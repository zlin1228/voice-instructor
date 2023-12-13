import { Scope } from "base-core/lib/scope.js"
import { WebAction } from "cm-teach-mode-web-common/lib/action/web-action.js"
import { DomSnapshot } from "cm-teach-mode-web-common/lib/event/dom-event.js"

export interface Environment {
  fetchDomSnapshot(scope: Scope): Promise<DomSnapshot>
}

export type Executable = (
  scope: Scope,
  environment: Environment
) => AsyncGenerator<WebAction>
