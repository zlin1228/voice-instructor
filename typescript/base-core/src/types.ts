import { arrayFindFirst, byKeyIs } from "./array.js"
import { abortIfUndefined } from "./debug.js"
import { KeyOfArray, MaybeOptional, typedIfEqual } from "./meta.js"
import { ValueOrError } from "./one-of.js"

import { isNotUndefined } from "./utils.js"

export type TypeClosure = {
  [K: symbol]: TypeAccessor
  [K: string]: never
  [K: number]: never
}

export interface TypeAccessor {
  closure: TypeClosure
  mapper: unknown // { type: T, in: ?, out: ? }
  accessor: unknown
}

export type TypeAccessorIn<
  Accessor extends TypeAccessor,
  T
> = Accessor["mapper"] & {
  type: T
} extends { in: infer R }
  ? R
  : never

export type TypeAccessorOut<
  Accessor extends TypeAccessor,
  T
> = Accessor["mapper"] & {
  type: T
} extends { out: infer R }
  ? R
  : never

export type TypeVisitor<C extends TypeClosure, M> = {
  [K in keyof C]: (C[K] & { closure: C; mapper: M })["accessor"]
}

export interface TypeMapperIn<T> {
  type: unknown
  in: this["type"]
  out: T
}

export interface TypeMapperOut<T> {
  type: unknown
  in: T
  out: this["type"]
}

export interface TypeMapperFixed<In, Out> {
  type: unknown
  in: In
  out: Out
}

export abstract class Type<C extends TypeClosure, T> {
  // https://stackoverflow.com/questions/61696173/strictfunctiontypes-restricts-generic-type
  _enforceTypeInvariant: ((t: T) => T) | undefined = undefined
  _enforceClosureCovariance: ((c: C) => void) | undefined = undefined

  constructor(public readonly symbol: keyof C) {}

  visit<M>(
    visitor: TypeVisitor<C, M>,
    value: M & { type: T } extends { in: infer R } ? R : never
  ): M & { type: T } extends { out: infer R } ? R : never {
    return (
      visitor[this.symbol] as (
        type: Type<C, T>,
        value: M & { type: T } extends { in: infer R } ? R : never
      ) => M & { type: T } extends { out: infer R } ? R : never
    )(this, value)
  }

  composeValue(visitor: TypeVisitor<C, TypeMapperOut<void>>): T {
    return this.visit<TypeMapperOut<void>>(visitor, undefined)
  }

  visitForType<TypeC extends TypeClosure, K extends keyof TypeC, M>(
    typeSymbol: K,
    typeVisitor: (TypeC[K] & { closure: C; mapper: M })["accessor"],
    nonTypeVisitor: () => M & { type: T } extends { out: infer R } ? R : never,
    value: M & { type: T } extends { in: infer R } ? R : never
  ): M & { type: T } extends { out: infer R } ? R : never {
    return this.symbol === typeSymbol
      ? (
          typeVisitor as (
            type: Type<C, T>,
            value: M & { type: T } extends { in: infer R } ? R : never
          ) => M & { type: T } extends { out: infer R } ? R : never
        )(this, value)
      : nonTypeVisitor()
  }

  extractValue<V>(value: T, visitor: TypeVisitor<C, TypeMapperIn<V>>): V {
    return this.visit<TypeMapperIn<V>>(visitor, value)
  }

  visitType<R>(visitor: TypeVisitor<C, TypeMapperFixed<undefined, R>>): R {
    return this.visit<TypeMapperFixed<undefined, R>>(visitor, undefined)
  }
}

export type CookType<TypeT> = TypeT extends Type<any, infer TypeT>
  ? TypeT
  : never

export class StringType extends Type<StringClosure, string> {
  static readonly symbol: unique symbol = Symbol("string")
  constructor() {
    super(StringType.symbol)
  }
}

interface StringAccessor extends TypeAccessor {
  accessor: (
    type: StringType,
    value: TypeAccessorIn<this, string>
  ) => TypeAccessorOut<this, string>
}

export interface StringClosure extends TypeClosure {
  [StringType.symbol]: StringAccessor
}

export const stringType = new StringType()

export class DoubleType extends Type<DoubleClosure, number> {
  static readonly symbol: unique symbol = Symbol("double")
  constructor() {
    super(DoubleType.symbol)
  }
}

interface DoubleAccessor extends TypeAccessor {
  accessor: (
    type: DoubleType,
    value: TypeAccessorIn<this, number>
  ) => TypeAccessorOut<this, number>
}

export interface DoubleClosure extends TypeClosure {
  [DoubleType.symbol]: DoubleAccessor
}

export const doubleType = new DoubleType()

export class Int32Type extends Type<Int32Closure, number> {
  static readonly symbol: unique symbol = Symbol("int32")
  constructor() {
    super(Int32Type.symbol)
  }
}

interface Int32Accessor extends TypeAccessor {
  accessor: (
    type: Int32Type,
    value: TypeAccessorIn<this, number>
  ) => TypeAccessorOut<this, number>
}

export interface Int32Closure extends TypeClosure {
  [Int32Type.symbol]: Int32Accessor
}

export const int32Type = new Int32Type()

// Note that `number` type in  JavaScript cannot safely represent an int64.

export class BooleanType extends Type<BooleanClosure, boolean> {
  static readonly symbol: unique symbol = Symbol("boolean")
  constructor() {
    super(BooleanType.symbol)
  }
}

interface BooleanAccessor extends TypeAccessor {
  accessor: (
    type: BooleanType,
    value: TypeAccessorIn<this, boolean>
  ) => TypeAccessorOut<this, boolean>
}

export interface BooleanClosure extends TypeClosure {
  [BooleanType.symbol]: BooleanAccessor
}

export const booleanType = new BooleanType()

export class TimestampType extends Type<TimestampClosure, Date> {
  static readonly symbol: unique symbol = Symbol("timestamp")
  constructor() {
    super(TimestampType.symbol)
  }
}

interface TimestampAccessor extends TypeAccessor {
  accessor: (
    type: TimestampType,
    value: TypeAccessorIn<this, Date>
  ) => TypeAccessorOut<this, Date>
}

export interface TimestampClosure extends TypeClosure {
  [TimestampType.symbol]: TimestampAccessor
}

export const timestampType = new TimestampType()

export class ArrayType<C extends ArrayClosure, T> extends Type<
  C,
  readonly T[]
> {
  static readonly symbol: unique symbol = Symbol("array")
  constructor(public readonly type: Type<C, T>) {
    super(ArrayType.symbol)
  }
}

interface ArrayAccessor extends TypeAccessor {
  accessor: <T>(
    type: this["closure"] extends ArrayClosure
      ? ArrayType<this["closure"], T>
      : never,
    value: TypeAccessorIn<this, readonly T[]>
  ) => TypeAccessorOut<this, readonly T[]>
}

export interface ArrayClosure extends TypeClosure {
  [ArrayType.symbol]: ArrayAccessor
}

export function arrayType<C extends TypeClosure, T>(
  type: Type<C, T>
): ArrayType<C & ArrayClosure, T> {
  return new ArrayType<C & ArrayClosure, T>(type)
}

export class MapType<C extends MapClosure, T> extends Type<
  C,
  Record<string, T>
> {
  static readonly symbol: unique symbol = Symbol("map")
  constructor(public readonly type: Type<C, T>) {
    super(MapType.symbol)
  }
}

interface MapAccessor extends TypeAccessor {
  accessor: <T>(
    type: this["closure"] extends MapClosure
      ? MapType<this["closure"], T>
      : never,
    value: TypeAccessorIn<this, Record<string, T>>
  ) => TypeAccessorOut<this, Record<string, T>>
}

export interface MapClosure extends TypeClosure {
  [MapType.symbol]: MapAccessor
}

export function mapType<C extends TypeClosure, T>(
  type: Type<C, T>
): MapType<C & MapClosure, T> {
  return new MapType<C & MapClosure, T>(type)
}

export interface FieldSpec<C extends TypeClosure, T> {
  readonly name: string
  readonly optional?: boolean
  readonly type: Type<C, T>
}
export type ObjectSpec<C extends TypeClosure> = readonly FieldSpec<C, any>[]

type CookObjectClosure<Spec extends ObjectSpec<any>> = Spec extends readonly [
  FieldSpec<infer C, any>,
  ...infer Rest extends readonly FieldSpec<any, any>[]
]
  ? C & CookObjectClosure<Rest>
  : {}

type CookObjectType<Spec extends ObjectSpec<any>> = Spec extends readonly [
  infer F extends FieldSpec<any, any>,
  ...infer Rest extends readonly FieldSpec<any, any>[]
]
  ? (F["optional"] extends true
      ? {
          readonly [K in F["name"]]?: CookType<F["type"]> | undefined
        }
      : {
          readonly [K in F["name"]]: CookType<F["type"]>
        }) &
      CookObjectType<Rest>
  : {}

// type CookObjectType<Spec extends ObjectSpec<any>> = {
//   [K in keyof CookObjectTypeImpl<Spec>]: CookObjectTypeImpl<Spec>[K]
// }

type FindObjectField<
  Spec extends ObjectSpec<any>,
  K extends keyof CookObjectType<Spec>
> = Spec extends readonly [
  infer F extends FieldSpec<any, any>,
  ...infer Rest extends readonly FieldSpec<any, any>[]
]
  ? F["name"] extends K
    ? F
    : K extends keyof CookObjectType<Rest>
    ? FindObjectField<Rest, K>
    : never
  : never

export class ObjectType<
  C extends ObjectClosure,
  Spec extends ObjectSpec<C>
> extends Type<C, CookObjectType<Spec>> {
  static readonly symbol: unique symbol = Symbol("object")
  constructor(public readonly spec: Spec) {
    super(ObjectType.symbol)
  }
  getFieldSpec<K extends keyof CookObjectType<Spec> & string>(
    name: K
  ): FindObjectField<Spec, K> {
    return abortIfUndefined(
      arrayFindFirst(this.spec, byKeyIs("name", name))
    )[1] as FindObjectField<Spec, K>
  }
  getFieldSpecUntyped(name: string): FieldSpec<C, any> {
    return abortIfUndefined(arrayFindFirst(this.spec, byKeyIs("name", name)))[1]
  }
  visitFields<R>(
    fn: <T, Opt extends boolean>(fieldSpec: {
      name: keyof CookObjectType<Spec> & string
      optional: Opt
      type: Type<C, T>
    }) => R
  ): R[] {
    return this.spec.map((field) =>
      fn(
        field as {
          name: keyof CookObjectType<Spec> & string
          optional: boolean
          type: Type<C, unknown>
        }
      )
    )
  }
  constructObject(
    fn: <T, Opt extends boolean>(fieldSpec: {
      name: keyof CookObjectType<Spec> & string
      optional: Opt
      type: Type<C, T>
    }) => MaybeOptional<Opt, T>
  ): CookObjectType<Spec> {
    return Object.fromEntries(
      this.visitFields<
        [keyof CookObjectType<Spec> & string, unknown] | undefined
      >((field) => {
        const value = fn(field)
        if (field.optional === true && value === undefined) {
          return undefined
        }
        return [field.name, value]
      }).filter(isNotUndefined)
    ) as CookObjectType<Spec>
  }
  destructObject<R>(
    value: CookObjectType<Spec>,
    fn: <T, Opt extends boolean>(
      fieldSpec: {
        name: keyof CookObjectType<Spec> & string
        optional: Opt
        type: Type<C, T>
      },
      value: T | undefined
    ) => R
  ): R[] {
    return this.visitFields<R>(
      <T, Opt extends boolean>(field: {
        name: keyof CookObjectType<Spec> & string
        optional: Opt
        type: Type<C, T>
      }) => {
        return fn<T, Opt>(
          field,
          typedIfEqual(
            field.optional,
            true as const,
            value[field.name] as unknown as T | undefined,
            value[field.name] as unknown as T
          )
        )
      }
    )
  }
}

type MakeObjectFieldsRequired<
  Spec extends ObjectSpec<any>,
  K extends string
> = Spec extends readonly [
  infer F extends FieldSpec<any, any>,
  ...infer Rest extends readonly FieldSpec<any, any>[]
]
  ? F["name"] extends K
    ? readonly [
        {
          readonly name: F["name"]
          readonly type: F["type"]
        },
        ...MakeObjectFieldsRequired<Rest, K>
      ]
    : readonly [F, ...MakeObjectFieldsRequired<Rest, K>]
  : []

type ExtractObjectOptionalFields<Spec extends ObjectSpec<any>> =
  Spec extends readonly [
    infer F extends FieldSpec<any, any>,
    ...infer Rest extends readonly FieldSpec<any, any>[]
  ]
    ? F["optional"] extends true
      ? F["name"] | ExtractObjectOptionalFields<Rest>
      : ExtractObjectOptionalFields<Rest>
    : never

export function makeObjectTypeFieldRequired<
  C extends ObjectClosure,
  Spec extends ObjectSpec<C>,
  K extends ExtractObjectOptionalFields<Spec>
>(
  objType: ObjectType<C, Spec>,
  key: K
): ObjectType<C, MakeObjectFieldsRequired<Spec, K>> {
  return objectType(
    objType.spec.map((field) =>
      field.name === key
        ? {
            name: field.name,
            type: field.type,
          }
        : field
    )
  ) as unknown as ObjectType<C, MakeObjectFieldsRequired<Spec, K>>
}

interface ObjectAccessor extends TypeAccessor {
  accessor: <Spec extends ObjectSpec<this["closure"]>>(
    type: this["closure"] extends ObjectClosure
      ? ObjectType<this["closure"], Spec>
      : never,
    value: TypeAccessorIn<this, CookObjectType<Spec>>
  ) => TypeAccessorOut<this, CookObjectType<Spec>>
}

export interface ObjectClosure extends TypeClosure {
  [ObjectType.symbol]: ObjectAccessor
}

export function objectType<const Spec extends ObjectSpec<any>>(
  spec: Spec
): ObjectType<CookObjectClosure<Spec> & ObjectClosure, Spec> {
  return new ObjectType(spec)
}

export class NullableType<C extends NullableClosure, T> extends Type<
  C,
  T | null
> {
  static readonly symbol: unique symbol = Symbol("nullable")
  constructor(public readonly type: Type<C, T>) {
    super(NullableType.symbol)
  }
}

interface NullableAccessor extends TypeAccessor {
  accessor: <T>(
    type: this["closure"] extends NullableClosure
      ? NullableType<this["closure"], T>
      : never,
    value: TypeAccessorIn<this, T | null>
  ) => TypeAccessorOut<this, T | null>
}

export interface NullableClosure extends TypeClosure {
  [NullableType.symbol]: NullableAccessor
}

export function nullableType<C extends TypeClosure, T>(
  type: Type<C, T>
): NullableType<C & NullableClosure, T> {
  if (type instanceof NullableType) {
    return type as NullableType<C & NullableClosure, T>
  }
  return new NullableType<C & NullableClosure, T>(type)
}

export class BinaryType extends Type<BinaryClosure, Uint8Array> {
  static readonly symbol: unique symbol = Symbol("binary")
  constructor() {
    super(BinaryType.symbol)
  }
}

interface BinaryAccessor extends TypeAccessor {
  accessor: (
    type: BinaryType,
    value: TypeAccessorIn<this, Uint8Array>
  ) => TypeAccessorOut<this, Uint8Array>
}

export interface BinaryClosure extends TypeClosure {
  [BinaryType.symbol]: BinaryAccessor
}

export const binaryType = new BinaryType()

export type CookUnionType<Spec extends readonly unknown[]> =
  Spec extends readonly [infer F, ...infer Rest extends readonly unknown[]]
    ? F | CookUnionType<Rest>
    : never

type CookUnionTypeArray<
  C extends UnionClosure,
  Spec extends readonly unknown[]
> = Spec extends readonly [infer F, ...infer Rest extends readonly unknown[]]
  ? readonly [Type<C, F>, ...CookUnionTypeArray<C, Rest>]
  : readonly []

export class UnionType<
  C extends UnionClosure,
  T extends readonly unknown[]
> extends Type<C, CookUnionType<T>> {
  static readonly symbol: unique symbol = Symbol("union")
  constructor(public readonly types: CookUnionTypeArray<C, T>) {
    super(UnionType.symbol)
  }
  constructUnion(
    ctor: <TT extends CookUnionType<T>>(type: Type<C, TT>) => ValueOrError<TT>
  ): ValueOrError<CookUnionType<T>> {
    const reasons: string[] = []
    for (const t of this.types) {
      const r = ctor(t)
      if (r.kind === "value") {
        return { kind: "value", value: r.value }
      } else {
        reasons.push(String(r.value))
      }
    }
    return { kind: "error", value: new Error(reasons.join(";")) }
  }
}

interface UnionAccessor extends TypeAccessor {
  accessor: <Spec extends readonly unknown[]>(
    type: this["closure"] extends UnionClosure
      ? UnionType<this["closure"], Spec>
      : never,
    value: TypeAccessorIn<this, CookUnionType<Spec>>
  ) => TypeAccessorOut<this, CookUnionType<Spec>>
}

export interface UnionClosure extends TypeClosure {
  [UnionType.symbol]: UnionAccessor
}

type CookUnionTypeClosure<Types extends readonly Type<any, any>[]> =
  Types extends readonly [
    Type<infer C, any>,
    ...infer Rest extends readonly Type<any, any>[]
  ]
    ? C & CookUnionTypeClosure<Rest>
    : {}

type CookUnionTypeSpec<Types extends readonly Type<any, any>[]> =
  Types extends readonly [
    Type<any, infer T>,
    ...infer Rest extends readonly Type<any, any>[]
  ]
    ? readonly [T, ...CookUnionTypeSpec<Rest>]
    : readonly []

export function unionType<Types extends readonly Type<any, any>[]>(
  types: Types
): UnionType<
  CookUnionTypeClosure<Types> & UnionClosure,
  CookUnionTypeSpec<Types>
> {
  return new UnionType<
    CookUnionTypeClosure<Types> & UnionClosure,
    CookUnionTypeSpec<Types>
  >(
    types as unknown as CookUnionTypeArray<
      CookUnionTypeClosure<Types> & UnionClosure,
      CookUnionTypeSpec<Types>
    >
  )
}

export class ValidationError extends Error {
  constructor(
    public type: Type<any, any>,
    public value: unknown,
    public why: string,
    public override cause: ValidationError | undefined
  ) {
    super(
      `Validation error: ${why}\n${
        cause !== undefined ? cause._getErrorString() : ""
      }`,
      { cause }
    )
  }

  flatten(): ValidationError[] {
    return [this, ...(this.cause === undefined ? [] : this.cause.flatten())]
  }

  _getErrorString(): string {
    return (
      "Validation error\n" +
      this.flatten()
        .map((ve) => `  ${ve.why}: ${JSON.stringify(ve.value, null, 2)}`)
        .join("\n")
    )
  }
}

export const emptyObjectType = objectType([] as const)
