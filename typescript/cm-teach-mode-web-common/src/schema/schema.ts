import { CookServiceHttpSchema } from "base-core/lib/http-schema.js"
import { emptyObjectType } from "base-core/lib/types.js"

export const teachModeWebHttpServiceSchema = [
  {
    kind: "post",
    value: {
      name: "test",
      request: {
        kind: "json",
        value: emptyObjectType,
      },
      response: {
        kind: "json",
        value: emptyObjectType,
      },
    },
  },
] as const

export type TeachModeWebHttpService = CookServiceHttpSchema<
  typeof teachModeWebHttpServiceSchema
>
