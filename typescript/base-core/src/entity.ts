import { abort } from "./debug.js"
import { Type } from "./types.js"
import { CommonClosure } from "./types-common.js"

export interface GenericEntity {
  readonly kind: string
  readonly type: Type<CommonClosure, any>
}

export interface Entity<T> extends GenericEntity {
  readonly kind: string
  readonly type: Type<CommonClosure, T>
}

export class EntityRegistry {
  #entityMap = new Map<string, GenericEntity>()

  public registerEntity<T>(
    kind: string,
    type: Type<CommonClosure, T>
  ): Entity<T> {
    if (this.#entityMap.has(kind)) {
      throw abort(
        `Cannot register multiple entities of the same kind: [${kind}]`
      )
    }
    const entity: Entity<T> = {
      kind,
      type,
    }
    this.#entityMap.set(kind, entity)
    return entity
  }
}

export const entityRegistry = new EntityRegistry()

export interface GenericEntityValue {
  readonly kind: string
  readonly value: unknown
}

export interface EntityValue<T> extends GenericEntityValue {
  readonly kind: string
  readonly value: T
}

export function buildEntityValue<T>(
  entity: Entity<T>,
  value: T
): EntityValue<T> {
  return {
    kind: entity.kind,
    value,
  }
}

export function buildUntypedEntityValue(value: unknown): GenericEntityValue {
  return {
    kind: "",
    value,
  }
}
