import {
  CookType,
  arrayType,
  booleanType,
  objectType,
  stringType,
} from "base-core/lib/types.js"

// AppProfile represents an application.
export const appProfileType = objectType([
  { name: "name", type: stringType },

  // Valid values: "web", "android"
  { name: "type", type: stringType },
  { name: "category", type: stringType },
  { name: "description", type: stringType },
  { name: "url", type: stringType },

  // True if the web application requires an account to use.
  { name: "accountRequired", type: booleanType },

  // True if the web application requires payment to use.
  { name: "paymentRequired", type: booleanType },

  // True if the web application streams audio.
  { name: "streamAudio", type: booleanType },

  // True if the web application streams video.
  { name: "streamVideo", type: booleanType },
])

export type AppProfile = CookType<typeof appProfileType>

// AppAccount represents an account for an application.
export const appAccountType = objectType([
  // Name of the account
  { name: "name", type: stringType },

  // Attributes of the account. The attribute name may be "username", "password", etc.
  {
    name: "attributes",
    type: arrayType(
      objectType([
        { name: "name", type: stringType },
        { name: "value", type: stringType },
      ])
    ),
  },
])

export type AppAccount = CookType<typeof appAccountType>

// BunnyParameter represents a single parameter for a bunny definition.
export const bunnyParameterType = objectType([
  { name: "name", type: stringType },

  // TODO: determine the set of valid values
  { name: "type", type: stringType },
])

export type BunnyParameter = CookType<typeof bunnyParameterType>

// PresetBunnyDefinition represents a preset bunny definition (which to be executed given
// arguments) for an application.
export const presetBunnyDefinitionType = objectType([
  { name: "name", type: stringType },
  { name: "description", type: stringType },
  { name: "cleanupDescription", type: stringType },
  { name: "parameters", type: arrayType(bunnyParameterType) },
  { name: "reportNames", type: arrayType(stringType) },
])

export type PresetBunnyDefinition = CookType<typeof presetBunnyDefinitionType>

// BunnyArgument represents a single argument for a bunny execution.
export const bunnyArgumentType = objectType([
  // The argument name should match the cooresponding bunny parameter name.
  { name: "name", type: stringType },

  { name: "value", type: stringType },
])

export type BunnyArgument = CookType<typeof bunnyArgumentType>

// BunnyExecution represents a bunny execution based on a bunny definition and arguments.
export const bunnyExecutionType = objectType([
  { name: "name", type: stringType },
  { name: "arguments", type: arrayType(bunnyParameterType) },
])

export type BunnyExecution = CookType<typeof bunnyExecutionType>
