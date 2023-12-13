import { byKeyIs } from "./array.js"
import { base64ToBytes } from "./data.js"
import { throwError, throwException } from "./exception.js"
import { makeMaybeOptional, typedIfEqual } from "./meta.js"
import { catchErrorSync, dispatchOneOf } from "./one-of.js"
import { stringToInt } from "./string.js"
import {
  ArrayClosure,
  ArrayType,
  BooleanClosure,
  BooleanType,
  NullableClosure,
  NullableType,
  DoubleClosure,
  DoubleType,
  Int32Closure,
  Int32Type,
  ObjectClosure,
  ObjectType,
  StringClosure,
  StringType,
  TimestampClosure,
  TimestampType,
  Type,
  ValidationError,
  BinaryType,
  BinaryClosure,
  TypeClosure,
  TypeMapperOut,
  UnionClosure,
  UnionType,
  MapClosure,
  MapType,
  TypeVisitor,
} from "./types.js"

import { forceGetProperty, forceSetProperty, isArray } from "./utils.js"

export type Normalizer<C extends TypeClosure> = <T>(
  type: Type<C, T>,
  value: unknown
) => T

export type NormalizerBuilder<C extends TypeClosure> = (
  upsteram: Normalizer<C>,
  normalizer: Normalizer<C>
) => Normalizer<C>

export function stringNormalizerBuilder<
  C extends StringClosure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      return type.visitForType<
        StringClosure,
        typeof StringType.symbol,
        TypeMapperOut<void>
      >(
        StringType.symbol,
        (type) => {
          if (typeof value === "string") {
            return value
          }
          throw new ValidationError(type, value, "expect string", undefined)
        },
        () => upstream(type, value),
        undefined
      )
    }
}

export function stringFromNumberNormalizerBuilder<
  C extends StringClosure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      if (type.symbol === StringType.symbol && typeof value === "number") {
        return upstream(type, value.toString())
      }
      return upstream(type, value)
    }
}

export function stringFromStringArrayNormalizerBuilder<
  C extends StringClosure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      if (type.symbol === StringType.symbol && isArray(value)) {
        if (value.length === 0) {
          return upstream(type, "")
        }
        return upstream(
          type,
          value
            .map((s) =>
              typeof s === "string" ? s : throwError("expect string")
            )
            .join("")
        )
      }
      return upstream(type, value)
    }
}

export function doubleNormalizerBuilder<
  C extends DoubleClosure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      return type.visitForType<
        DoubleClosure,
        typeof DoubleType.symbol,
        TypeMapperOut<void>
      >(
        DoubleType.symbol,
        (type) => {
          if (typeof value === "number") {
            if (!Number.isFinite(value)) {
              throw new ValidationError(
                type,
                value,
                "expect double, but the number is invalid",
                undefined
              )
            }
            return value
          }
          throw new ValidationError(type, value, "expect double", undefined)
        },
        () => upstream(type, value),
        undefined
      )
    }
}

export function doubleFromStringNormalizerBuilder<
  C extends DoubleClosure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      if (type.symbol === DoubleType.symbol && typeof value === "string") {
        return upstream(type, Number(value))
      }
      return upstream(type, value)
    }
}

export function int32NormalizerBuilder<
  C extends Int32Closure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      return type.visitForType<
        Int32Closure,
        typeof Int32Type.symbol,
        TypeMapperOut<void>
      >(
        Int32Type.symbol,
        (type) => {
          if (typeof value === "number") {
            if (
              !(
                Number.isInteger(value) &&
                value <= 0x7fffffff &&
                value >= -0x80000000
              )
            ) {
              throw new ValidationError(
                type,
                value,
                "expect int32, but the number is invalid",
                undefined
              )
            }
            return value
          }
          throw new ValidationError(type, value, "expect int32", undefined)
        },
        () => upstream(type, value),
        undefined
      )
    }
}

export function int32FromStringNormalizerBuilder<
  C extends Int32Closure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      if (type.symbol === Int32Type.symbol && typeof value === "string") {
        return upstream(type, stringToInt(value) ?? value)
      }
      return upstream(type, value)
    }
}

export function booleanNormalizerBuilder<
  C extends BooleanClosure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      return type.visitForType<
        BooleanClosure,
        typeof BooleanType.symbol,
        TypeMapperOut<void>
      >(
        BooleanType.symbol,
        (type) => {
          if (typeof value === "boolean") {
            return value
          }
          throw new ValidationError(type, value, "expect boolean", undefined)
        },
        () => upstream(type, value),
        undefined
      )
    }
}

export function booleanFromStringNormalizerBuilder<
  C extends BooleanClosure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      if (type.symbol === BooleanType.symbol && typeof value === "string") {
        if (value === "true") return upstream(type, true)
        if (value === "false") return upstream(type, false)
      }
      return upstream(type, value)
    }
}

export function timestampNormalizerBuilder<
  C extends TimestampClosure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      return type.visitForType<
        TimestampClosure,
        typeof TimestampType.symbol,
        TypeMapperOut<void>
      >(
        TimestampType.symbol,
        (type) => {
          if (value instanceof Date) {
            if (isNaN(value.getTime())) {
              throw new ValidationError(
                type,
                value,
                "expect valid date",
                undefined
              )
            }
            return value
          }
          throw new ValidationError(type, value, "expect date", undefined)
        },
        () => upstream(type, value),
        undefined
      )
    }
}

export function timestampFromStringNormalizerBuilder<
  C extends TimestampClosure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      if (type.symbol === TimestampType.symbol && typeof value === "string") {
        const x = stringToInt(value)
        if (x === undefined) {
          return upstream(type, new Date(value))
        } else {
          return upstream(type, x)
        }
      }
      return upstream(type, value)
    }
}

export function timestampFromNumberNormalizerBuilder<
  C extends TimestampClosure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      if (type.symbol === TimestampType.symbol && typeof value === "number") {
        return upstream(type, new Date(value))
      }
      return upstream(type, value)
    }
}

export function binaryNormalizerBuilder<
  C extends BinaryClosure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      return type.visitForType<
        BinaryClosure,
        typeof BinaryType.symbol,
        TypeMapperOut<void>
      >(
        BinaryType.symbol,
        (type) => {
          if (value instanceof Uint8Array) {
            return value
          }
          throw new ValidationError(
            type,
            value,
            "expect Uint8Array as binary",
            undefined
          )
        },
        () => upstream(type, value),
        undefined
      )
    }
}

export function binaryFromBase64NormalizerBuilder<
  C extends BinaryClosure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      if (type.symbol === BinaryType.symbol && typeof value === "string") {
        return upstream(type, base64ToBytes(value))
      }
      return upstream(type, value)
    }
}

export function arrayNormalizerBuilder<
  C extends ArrayClosure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      return type.visitForType<
        ArrayClosure,
        typeof ArrayType.symbol,
        TypeMapperOut<void>
      >(
        ArrayType.symbol,
        (type) => {
          if (isArray(value)) {
            return value.map((x, idx) => {
              try {
                return normalizer(type.type, x)
              } catch (err) {
                if (err instanceof ValidationError) {
                  throw new ValidationError(
                    type,
                    value,
                    `expect valid element [${idx}]`,
                    err
                  )
                }
                throw err
              }
            })
          }
          throw new ValidationError(type, value, "expect array", undefined)
        },
        () => upstream(type, value),
        undefined
      )
    }
}

export function arrayFromObjectNormalizerBuilder<
  C extends ArrayClosure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      if (
        type.symbol === ArrayType.symbol &&
        !isArray(value) &&
        value instanceof Object &&
        forceGetProperty(value, "0") !== undefined
      ) {
        const values: unknown[] = []
        for (let idx = 0; ; ++idx) {
          const x = forceGetProperty(value, idx.toString())
          if (x === undefined) {
            break
          }
          values.push(x)
        }
        return upstream(type, values)
      }
      return upstream(type, value)
    }
}

export function arrayFromJsonNormalizerBuilder<
  C extends ArrayClosure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      if (type.symbol === ArrayType.symbol && typeof value === "string") {
        const objWithError = catchErrorSync(
          Error,
          () => JSON.parse(value) as unknown
        )
        return dispatchOneOf(objWithError, {
          value: (obj) => upstream(type, obj),
          error: (e) =>
            throwException(
              new ValidationError(
                type,
                value,
                `expect JSON for array, but got error: ${String(e)}`,
                undefined
              )
            ),
        })
      }
      return upstream(type, value)
    }
}

export function arrayFromNullNormalizerBuilder<
  C extends ArrayClosure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      if (
        type.symbol === ArrayType.symbol &&
        (value === null || value === undefined)
      ) {
        return upstream(type, [])
      }
      return upstream(type, value)
    }
}

export function mapNormalizerBuilder<
  C extends MapClosure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      return type.visitForType<
        MapClosure,
        typeof MapType.symbol,
        TypeMapperOut<void>
      >(
        MapType.symbol,
        (type) => {
          if (typeof value !== "object") {
            throw new ValidationError(
              type,
              value,
              `expect object as map but got type ${typeof value}`,
              undefined
            )
          }
          if (value === null) {
            throw new ValidationError(type, value, "expect non-null", undefined)
          }
          return Object.fromEntries(
            Object.entries(value).map(([key, x]) => {
              try {
                return [key, normalizer(type.type, x)]
              } catch (err) {
                if (err instanceof ValidationError) {
                  throw new ValidationError(
                    type,
                    value,
                    `expect valid field [${key}]`,
                    err
                  )
                }
                throw err
              }
            })
          )
        },
        () => upstream(type, value),
        undefined
      )
    }
}

export interface ObjectNormalizerOptions {
  extraObjectProperties?: "error" | "strip" | "preserve"
}

export function objectNormalizerBuilder<C extends ObjectClosure>(
  options: ObjectNormalizerOptions | undefined = undefined
): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      return type.visitForType<
        ObjectClosure,
        typeof ObjectType.symbol,
        TypeMapperOut<void>
      >(
        ObjectType.symbol,
        (type) => {
          if (typeof value !== "object") {
            throw new ValidationError(
              type,
              value,
              `expect object but got type ${typeof value}`,
              undefined
            )
          }
          if (value === null) {
            throw new ValidationError(type, value, "expect non-null", undefined)
          }
          const obj = type.constructObject((field) => {
            const x = forceGetProperty(value, field.name)
            try {
              return makeMaybeOptional(
                field.optional,
                () => (x === undefined ? undefined : normalizer(field.type, x)),
                () => normalizer(field.type, x)
              )
            } catch (err) {
              if (err instanceof ValidationError) {
                throw new ValidationError(
                  type,
                  value,
                  `expect valid field [${field.name}]`,
                  err
                )
              }
              throw err
            }
          })
          if (options?.extraObjectProperties !== "strip") {
            for (const [k, v] of Object.entries(value)) {
              if (type.spec.some(byKeyIs("name", k))) continue
              if (options?.extraObjectProperties === "preserve") {
                forceSetProperty(obj as object, k, v)
              } else {
                throw new ValidationError(
                  type,
                  obj,
                  `do not expect unknown field [${k}]`,
                  undefined
                )
              }
            }
          }
          return obj
        },
        () => upstream(type, value),
        undefined
      )
    }
}

export function objectFromJsonNormalizerBuilder<
  C extends ObjectClosure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      if (type.symbol === ObjectType.symbol && typeof value === "string") {
        const objWithError = catchErrorSync(
          Error,
          () => JSON.parse(value) as unknown
        )
        return dispatchOneOf(objWithError, {
          value: (obj) => upstream(type, obj),
          error: (e) =>
            throwException(
              new ValidationError(
                type,
                value,
                `expect JSON for object, but got error: ${String(e)}`,
                undefined
              )
            ),
        })
      }
      return upstream(type, value)
    }
}

export function nullableNormalizerBuilder<
  C extends NullableClosure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      return type.visitForType<
        NullableClosure,
        typeof NullableType.symbol,
        TypeMapperOut<void>
      >(
        NullableType.symbol,
        (type) => {
          if (value === null || value === undefined) {
            return null
          }
          return normalizer(type.type, value)
        },
        () => upstream(type, value),
        undefined
      )
    }
}

export function unionNormalizerBuilder<
  C extends UnionClosure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      return type.visitForType<
        UnionClosure,
        typeof UnionType.symbol,
        TypeMapperOut<void>
      >(
        UnionType.symbol,
        (type) => {
          const r = type.constructUnion((t) => {
            return catchErrorSync(ValidationError, () => normalizer(t, value))
          })
          return dispatchOneOf(r, {
            value: (v) => v,
            error: (e) =>
              throwException(
                new ValidationError(
                  type,
                  value,
                  `expect union, but value doesn't match any types: ${String(
                    e
                  )}`,
                  undefined
                )
              ),
          })
        },
        () => upstream(type, value),
        undefined
      )
    }
}

export function buildNormalizer<C extends TypeClosure>(
  builders: NormalizerBuilder<C>[]
): Normalizer<C> {
  let upstream: Normalizer<C> = (type, value) => {
    throw new Error(`Unhandled: ${String(value)}`)
  }
  const normalizer: Normalizer<C> = (type, value) => upstream(type, value)
  for (const builder of builders) {
    upstream = builder(upstream, normalizer)
  }
  return normalizer
}

export type CoreClosure = StringClosure &
  DoubleClosure &
  Int32Closure &
  ObjectClosure &
  ArrayClosure &
  MapClosure &
  BooleanClosure &
  TimestampClosure &
  NullableClosure &
  BinaryClosure

export type CommonClosure = CoreClosure & UnionClosure

export const coreNormalizer: Normalizer<CoreClosure> = buildNormalizer([
  stringNormalizerBuilder(),
  doubleNormalizerBuilder(),
  int32NormalizerBuilder(),
  booleanNormalizerBuilder(),
  timestampNormalizerBuilder(),
  binaryNormalizerBuilder(),
  objectNormalizerBuilder(),
  mapNormalizerBuilder(),
  arrayNormalizerBuilder(),
  nullableNormalizerBuilder(),
])

export const commonNormalizer: Normalizer<CommonClosure> = buildNormalizer([
  stringNormalizerBuilder(),
  doubleNormalizerBuilder(),
  int32NormalizerBuilder(),
  booleanNormalizerBuilder(),
  timestampNormalizerBuilder(),
  binaryNormalizerBuilder(),
  objectNormalizerBuilder({ extraObjectProperties: "preserve" }),
  mapNormalizerBuilder(),
  arrayNormalizerBuilder(),
  nullableNormalizerBuilder(),
  unionNormalizerBuilder(),

  stringFromStringArrayNormalizerBuilder(),
  stringFromNumberNormalizerBuilder(),
  doubleFromStringNormalizerBuilder(),
  int32FromStringNormalizerBuilder(),
  booleanFromStringNormalizerBuilder(),
  timestampFromNumberNormalizerBuilder(),
  timestampFromStringNormalizerBuilder(),
  binaryFromBase64NormalizerBuilder(),
  arrayFromObjectNormalizerBuilder(),
  arrayFromJsonNormalizerBuilder(),
  arrayFromNullNormalizerBuilder(),
  objectFromJsonNormalizerBuilder(),
])

export function typeToTypeScriptDefinition<T>(
  type: Type<CommonClosure, T>
): string {
  return type.visitType<string>({
    [StringType.symbol]: (type) => "string",
    [DoubleType.symbol]: (type) => "number",
    [Int32Type.symbol]: (type) => "number",
    [ObjectType.symbol]: (type) =>
      `{ ${type
        .visitFields(
          ({ name, optional, type }) =>
            `${name}: ${typeToTypeScriptDefinition(type)}`
        )
        .join(", ")} }`,
    [ArrayType.symbol]: (type) => `${typeToTypeScriptDefinition(type.type)}[]`,
    [MapType.symbol]: (type) =>
      `{ [key: string]: ${typeToTypeScriptDefinition(type.type)} }`,
    [BooleanType.symbol]: (type) => "boolean",
    [TimestampType.symbol]: (type) => "Date",
    [BinaryType.symbol]: (type) => "Uint8Array",
    [NullableType.symbol]: (type) =>
      `( ${typeToTypeScriptDefinition(type.type)} | null )`,
    [UnionType.symbol]: (type) =>
      `( ${type.types
        .map((type) => typeToTypeScriptDefinition(type))
        .join(" | ")} )`,
  })
}
