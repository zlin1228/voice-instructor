import mongodb from "mongodb"

import {
  abort,
  abortIfUndefined,
  abortIfNotEqual,
  asInstanceOrAbort,
} from "base-core/lib/debug.js"
import { structEntries, structEntries2 } from "base-core/lib/meta.js"
import {
  arrayType,
  ArrayType,
  booleanType,
  doubleType,
  int32Type,
  NullableType,
  nullableType,
  ObjectSpec,
  objectType,
  ObjectType,
  stringType,
  Type,
} from "base-core/lib/types.js"
import { CoreClosure } from "base-core/lib/types-common.js"
import { MongoCollection } from "./mongodb.js"

type Join<T extends unknown[], D extends string> = T extends []
  ? ""
  : T extends [string | number]
  ? `${T[0]}`
  : T extends [string | number, ...infer R]
  ? `${T[0]}${D}${Join<R, D>}`
  : never

type NestedPaths<Type> = Type extends
  | string
  | number
  | boolean
  | Date
  | Uint8Array
  ? []
  : Type extends readonly (infer V)[]
  ? [] | NestedPaths<V> | [number] | [number, ...NestedPaths<V>]
  : Type extends object
  ? {
      [Key in Extract<keyof Type, string>]:
        | [Key]
        | [Key, ...NestedPaths<Type[Key]>]
    }[Extract<keyof Type, string>]
  : []

type PropertyType<Type, Property extends string> =
  | (Property extends keyof Type
      ? Type[Property]
      : Property extends `${number}`
      ? Type extends readonly (infer V)[]
        ? V
        : never
      : Property extends `${infer Key}.${infer Rest}`
      ? Key extends `${number}`
        ? Type extends readonly (infer V)[]
          ? PropertyType<V, Rest>
          : never
        : Key extends keyof Type
        ? PropertyType<Type[Key], Rest>
        : never
      : never)
  | (Type extends readonly (infer V)[]
      ? PropertyType<V | undefined | null, Property>
      : never)
  | (Type & (undefined | null) extends never
      ? never
      : PropertyType<NonNullable<Type>, Property> | undefined)

type AlternativeType<T> = T extends readonly (infer U)[] ? T | U : T

type FilterOperators<T> = ({
  $eq?: undefined extends T ? T | null : T
  $ne?: undefined extends T ? T | null : T
  $in?: readonly T[]
  $nin?: readonly T[]
  $expr?: unknown
} & (T extends boolean ? { $not?: T } : {}) &
  (T extends number | string | Date
    ? {
        $gt?: T
        $gte?: T
        $lt?: T
        $lte?: T
      }
    : {})) &
  (T extends number
    ? {
        $mod?: [number, number]
      }
    : {}) &
  (T extends string
    ? {
        $regex?: RegExp
      }
    : {}) &
  (undefined extends T
    ? {
        $exists?: boolean
      }
    : {}) &
  (T extends readonly (infer U)[]
    ? {
        $all?: MongoFilter<U>
        $elemMatch?: MongoFilter<U>
        // $size?: FilterOperators<number>
      }
    : {})

type Condition<T> = AlternativeType<T> | FilterOperators<AlternativeType<T>>

export type MongoFilter<T> = {
  $and?: MongoFilter<T>[]
  $nor?: MongoFilter<T>[]
  $or?: MongoFilter<T>[]
  $text?: {
    $search: string
  }
} & {
  [Property in Join<NestedPaths<T>, ".">]?: Condition<PropertyType<T, Property>>
}

// export type MongoUpdate<T> = {
//   $set?: {
//     [Property in Join<NestedPaths<T>, ".">]?: PropertyType<T, Property>
//   }
//   $unset?: {
//     [Property in Join<NestedPaths<T>, ".">]?: ""
//   }
// }

export type MongoUpdate<T> = {
  $set?: {
    [Property in Join<NestedPaths<T>, ".">]?: PropertyType<T, Property>
  }
  $unset?: {
    [Property in Join<NestedPaths<T>, ".">]?: ""
  }
}

export type MongoSort<T> = {
  [Property in Join<NestedPaths<T>, ".">]?: 1 | -1
}

export interface AggregateExpressionUntyped {
  buildType(): Type<CoreClosure, any>
  buildMongoExpression(): unknown
}

export type AggregateExpression<T> = AggregateExpressionUntyped & {
  buildType(): Type<CoreClosure, T>
  buildMongoExpression(): unknown
} & ([T] extends [boolean]
    ? {
        and: (
          this: AggregateExpression<boolean>,
          expr: AggregateExpression<boolean>
        ) => AggregateExpression<boolean>
        or: (
          this: AggregateExpression<boolean>,
          expr: AggregateExpression<boolean>
        ) => AggregateExpression<boolean>
        not: (
          this: AggregateExpression<boolean>
        ) => AggregateExpression<boolean>
      }
    : {}) &
  ([NonNullable<T>] extends [{ [key: string]: unknown }]
    ? {
        field: <K extends keyof NonNullable<T> & string>(
          this: AggregateExpression<T>,
          field: K
        ) => AggregateExpression<
          | NonNullable<NonNullable<T>[K]>
          | (T & (undefined | null) extends never ? never : null)
          | (NonNullable<T>[K] & (undefined | null) extends never
              ? never
              : null)
        >
      }
    : {}) &
  ([T] extends
    | [string]
    | [number]
    | [Date]
    | [boolean]
    | [string | null | undefined]
    | [number | null | undefined]
    | [Date | null | undefined]
    | [boolean | null | undefined]
    ? {
        eq: (
          this: AggregateExpression<T>,
          value: T
        ) => AggregateExpression<boolean>
        ne: (
          this: AggregateExpression<T>,
          value: T
        ) => AggregateExpression<boolean>
      }
    : {}) &
  ([T] extends [string] | [number] | [Date]
    ? {
        gt: (
          this: AggregateExpression<T>,
          value: T
        ) => AggregateExpression<boolean>
        gte: (
          this: AggregateExpression<T>,
          value: T
        ) => AggregateExpression<boolean>
        lt: (
          this: AggregateExpression<T>,
          value: T
        ) => AggregateExpression<boolean>
        lte: (
          this: AggregateExpression<T>,
          value: T
        ) => AggregateExpression<boolean>
      }
    : {}) &
  ((undefined | null) & T extends never
    ? {}
    : {
        nullOr: (
          this: AggregateExpression<T>,
          value: NonNullable<T>
        ) => AggregateExpression<NonNullable<T>>
        isNull: (this: AggregateExpression<T>) => AggregateExpression<boolean>
        isNotNull: (
          this: AggregateExpression<T>
        ) => AggregateExpression<boolean>
      }) &
  ([T] extends [readonly unknown[] | null | undefined]
    ? {
        size: (this: AggregateExpression<T>) => AggregateExpression<number>
        arrayElemAt: (
          this: AggregateExpression<T>,
          index: number
        ) => AggregateExpression<
          (NonNullable<T> extends readonly (infer V)[] ? V : never) | null
        >
        filter: (
          this: AggregateExpression<T>,
          variableName: string,
          predicate: (
            elementExpression: AggregateExpression<
              T extends readonly (infer V)[] ? V | undefined | null : never
            >
          ) => AggregateExpression<boolean>
        ) => AggregateExpression<
          (T extends readonly (infer V)[] ? V | undefined | null : never)[]
        >
      }
    : {}) &
  ([T] extends [string]
    ? {
        regex: (
          this: AggregateExpression<string>,
          regex: RegExp
        ) => AggregateExpression<boolean>
        regexFindAllMatches: (
          this: AggregateExpression<string>,
          regex: RegExp
        ) => AggregateExpression<readonly string[]>
        trim: (this: AggregateExpression<string>) => AggregateExpression<string>
        toLower: (
          this: AggregateExpression<string>
        ) => AggregateExpression<string>
      }
    : {})

export function aggExprObj<
  Spec extends Record<string, AggregateExpressionUntyped>
>(
  spec: Spec
): AggregateExpression<{
  [K in keyof Spec]: Spec[K] extends AggregateExpression<infer U> ? U : never
}> {
  return buildAggregateExpression(
    objectType(
      structEntries(spec).map(([name, expr]) => ({
        name: name as string,
        type: expr.buildType(),
      }))
    ),
    Object.fromEntries(
      structEntries(spec).map(([key, expr]) => [
        key,
        expr.buildMongoExpression(),
      ])
    )
  ) as unknown as AggregateExpression<{
    [K in keyof Spec]: Spec[K] extends AggregateExpression<infer U> ? U : never
  }>
}

// export function aggExprObj<T>(
//   type: Type<CoreClosure, T>,
//   spec: {
//     [K in keyof T]: AggregateExpression<T[K]>
//   }
// ): AggregateExpression<T> {
//   return buildAggregateExpression(
//     type,
//     Object.fromEntries(
//       structEntries(spec).map(([key, expr]) => [
//         key,
//         expr.buildMongoExpression(),
//       ])
//     )
//   )
// }

export function aggExprLiteralDouble(
  value: number
): AggregateExpression<number> {
  return buildAggregateExpression(doubleType, value)
}

export function aggExprLiteral<T>(
  type: Type<CoreClosure, T>,
  value: T
): AggregateExpression<T> {
  return buildAggregateExpression(type, { $literal: value })
}

export function aggExprEq<T>(
  expr0: AggregateExpression<T>,
  expr1: AggregateExpression<T>
): AggregateExpression<boolean> {
  return buildAggregateExpression(booleanType, {
    $eq: [expr0.buildMongoExpression(), expr1.buildMongoExpression()],
  })
}

export function aggExprAdd(
  exprs: AggregateExpression<number>[]
): AggregateExpression<number> {
  return buildAggregateExpression(doubleType, {
    $add: exprs.map((expr) => expr.buildMongoExpression()),
  })
}

export function aggExprDivide(
  expr0: AggregateExpression<number>,
  expr1: AggregateExpression<number>
): AggregateExpression<number> {
  return buildAggregateExpression(doubleType, {
    $divide: [expr0.buildMongoExpression(), expr1.buildMongoExpression()],
  })
}

export function aggExprConcatArrays<T>(
  exprs: AggregateExpression<readonly T[]>[]
): AggregateExpression<readonly T[]> {
  return buildAggregateExpression<readonly T[]>(
    abortIfUndefined(exprs[0]).buildType() as Type<CoreClosure, readonly T[]>,
    {
      $concatArrays: exprs.map((expr) => expr.buildMongoExpression()),
    }
  )
}

export function getNullableInnerType<T>(
  type: Type<CoreClosure, T>
): Type<CoreClosure, NonNullable<T>> {
  let innerType = type
  while (innerType instanceof NullableType) {
    innerType = innerType.type as Type<CoreClosure, T>
  }
  return innerType as unknown as Type<CoreClosure, NonNullable<T>>
}

export function getNullableArrayInnerTypeOrAbort<T>(
  type: Type<CoreClosure, T>
): NonNullable<T> extends readonly (infer V)[] ? Type<CoreClosure, V> : never {
  const innerType = getNullableInnerType(type)
  return asInstanceOrAbort(ArrayType, innerType)
    .type as unknown as NonNullable<T> extends readonly (infer V)[]
    ? Type<CoreClosure, V>
    : never
}

export function buildAggregateExpression<T>(
  type: Type<CoreClosure, T>,
  mongoExpression: unknown
): AggregateExpression<T> {
  const ret = {
    buildMongoExpression() {
      return mongoExpression
    },
    buildType() {
      return type
    },
    and(expr: AggregateExpression<boolean>) {
      return buildAggregateExpression(booleanType, {
        $and: [mongoExpression, expr.buildMongoExpression()],
      })
    },
    or(expr: AggregateExpression<boolean>) {
      return buildAggregateExpression(booleanType, {
        $or: [mongoExpression, expr.buildMongoExpression()],
      })
    },
    not() {
      return buildAggregateExpression(booleanType, {
        $not: [mongoExpression],
      })
    },
    field<K extends keyof NonNullable<T> & string>(
      field: K
    ): AggregateExpression<
      | NonNullable<NonNullable<T>[K]>
      | (T & (undefined | null) extends never ? never : null)
      | (NonNullable<T>[K] & (undefined | null) extends never ? never : null)
    > {
      let nullable = false
      let innerType = type
      if (type instanceof NullableType) {
        nullable = true
        innerType = type.type as Type<CoreClosure, T>
      }
      const objType = asInstanceOrAbort(ObjectType, innerType) as ObjectType<
        CoreClosure,
        any
      >
      const f = objType.getFieldSpecUntyped(field)
      if (f.optional === true) nullable = true
      const fieldType = f.type
      let resultType = fieldType
      if (nullable && !(fieldType instanceof NullableType)) {
        resultType = nullableType(fieldType)
      }
      const input = this.buildMongoExpression()
      if (typeof input === "string" && input.startsWith("$")) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return buildAggregateExpression(resultType, `${input}.${field}`) as any
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return buildAggregateExpression(resultType, {
        $getField: {
          field,
          input,
        },
      }) as any
    },
    eq(value: T) {
      return buildAggregateExpression(booleanType, {
        $eq: [mongoExpression, value],
      })
    },
    ne(value: T) {
      return buildAggregateExpression(booleanType, {
        $ne: [mongoExpression, value],
      })
    },
    gt(value: T) {
      return buildAggregateExpression(booleanType, {
        $gt: [mongoExpression, value],
      })
    },
    gte(value: T) {
      return buildAggregateExpression(booleanType, {
        $gte: [mongoExpression, value],
      })
    },
    lt(value: T) {
      return buildAggregateExpression(booleanType, {
        $lt: [mongoExpression, value],
      })
    },
    lte(value: T) {
      return buildAggregateExpression(booleanType, {
        $lte: [mongoExpression, value],
      })
    },
    nullOr(value: NonNullable<T>) {
      const innerType = asInstanceOrAbort(NullableType, type) as NullableType<
        CoreClosure,
        NonNullable<T>
      >
      return buildAggregateExpression(innerType.type, {
        $ifNull: [mongoExpression, value],
      })
    },
    isNull() {
      return buildAggregateExpression(booleanType, {
        $eq: [{ $ifNull: [mongoExpression, null] }, null],
      })
    },
    isNotNull() {
      return buildAggregateExpression(booleanType, {
        $ne: [{ $ifNull: [mongoExpression, null] }, null],
      })
    },
    size() {
      return buildAggregateExpression(int32Type, {
        $size: {
          $ifNull: [mongoExpression, []],
        },
      })
    },
    arrayElemAt(index: number) {
      let innerType = type
      if (type instanceof NullableType) {
        innerType = type.type as Type<CoreClosure, T>
      }
      const instanceType = asInstanceOrAbort(ArrayType, innerType) as ArrayType<
        CoreClosure,
        T extends (infer V)[] ? V : never
      >
      return buildAggregateExpression(nullableType(instanceType.type), {
        $arrayElemAt: [mongoExpression, index],
      })
    },
    filter<V>(
      variableName: string,
      predictate: (
        expression: AggregateExpression<V>
      ) => AggregateExpression<boolean>
    ) {
      const aType = asInstanceOrAbort(ArrayType, type) as ArrayType<
        CoreClosure,
        V
      >
      return buildAggregateExpression(type, {
        $filter: {
          input: mongoExpression,
          cond: predictate(
            buildAggregateExpression(aType.type, "$$" + variableName)
          ).buildMongoExpression(),
          as: variableName,
        },
      })
    },
    regex(regex: RegExp) {
      return buildAggregateExpression(booleanType, {
        $regexMatch: {
          input: mongoExpression,
          regex,
        },
      })
    },
    regexFindAllMatches(regex: RegExp) {
      return buildAggregateExpression(arrayType(stringType), {
        $map: {
          input: {
            $regexFindAll: {
              input: mongoExpression,
              regex,
            },
          },
          as: "match",
          in: "$$match.match",
        },
      })
    },
    trim() {
      return buildAggregateExpression(stringType, {
        $trim: {
          input: mongoExpression,
        },
      })
    },
    toLower() {
      return buildAggregateExpression(stringType, {
        $toLower: mongoExpression,
      })
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return ret as any
}

export class MongoPipelineBuilder<T> {
  constructor(
    public readonly type: Type<CoreClosure, T>,
    public readonly stageDocs: mongodb.Document[]
  ) {}

  as<U extends T>(type: Type<CoreClosure, U>): MongoPipelineBuilder<U> {
    return new MongoPipelineBuilder(type, this.stageDocs)
  }

  project<Spec extends Record<string, AggregateExpressionUntyped | 1>>(
    projectSpecBuilder: (root: AggregateExpression<T>) => Spec
  ): MongoPipelineBuilder<{
    [K in keyof Spec]: Spec[K] extends 1
      ? K extends keyof T
        ? T[K]
        : never
      : Spec[K] extends AggregateExpression<infer U>
      ? U
      : never
  }> {
    const projectSpec = projectSpecBuilder(
      buildAggregateExpression(this.type, "$$ROOT")
    )
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return new MongoPipelineBuilder(
      objectType(
        structEntries(projectSpec).map(([name, expr]) => {
          return {
            name: name as string,
            type:
              expr === 1
                ? asInstanceOrAbort(ObjectType, this.type).getFieldSpecUntyped(
                    name as string
                  ).type
                : expr.buildType(),
          }
        })
      ),
      [
        ...this.stageDocs,
        {
          $project: Object.fromEntries(
            structEntries(projectSpec).map(([name, expr]) => [
              name,
              expr === 1 ? 1 : expr.buildMongoExpression(),
            ])
          ),
        },
      ]
    ) as any
  }

  match(filter: MongoFilter<T>): MongoPipelineBuilder<T> {
    return new MongoPipelineBuilder(this.type, [
      ...this.stageDocs,
      {
        $match: filter,
      },
    ])
  }

  matchByExpr(
    exprBuilder: (root: AggregateExpression<T>) => AggregateExpression<boolean>
  ): MongoPipelineBuilder<T> {
    return new MongoPipelineBuilder(this.type, [
      ...this.stageDocs,
      {
        $match: {
          $expr: exprBuilder(
            buildAggregateExpression(this.type, "$$ROOT")
          ).buildMongoExpression(),
        },
      },
    ])
  }

  limit(size: number): MongoPipelineBuilder<T> {
    return new MongoPipelineBuilder(this.type, [
      ...this.stageDocs,
      {
        $limit: size,
      },
    ])
  }

  skip(size: number): MongoPipelineBuilder<T> {
    return new MongoPipelineBuilder(this.type, [
      ...this.stageDocs,
      {
        $skip: size,
      },
    ])
  }

  sort(sortExpr: MongoSort<T>): MongoPipelineBuilder<T> {
    return new MongoPipelineBuilder(this.type, [
      ...this.stageDocs,
      {
        $sort: sortExpr,
      },
    ])
  }

  sample(size: number): MongoPipelineBuilder<T> {
    return new MongoPipelineBuilder(this.type, [
      ...this.stageDocs,
      {
        $sample: {
          size,
        },
      },
    ])
  }

  group<
    Spec extends Record<
      string,
      | {
          $avg: AggregateExpression<number>
        }
      | {
          $sum: AggregateExpression<number>
        }
      | {
          $first: AggregateExpressionUntyped
        }
      | {
          $last: AggregateExpressionUntyped
        }
      | {
          $count: {}
        }
      | {
          $push: AggregateExpressionUntyped
        }
      | {
          $min: AggregateExpressionUntyped
        }
      | {
          $max: AggregateExpressionUntyped
        }
      | {
          $bottom: {
            sortBy: MongoSort<T>
            output: AggregateExpressionUntyped
          }
        }
      | {
          $top: {
            sortBy: MongoSort<T>
            output: AggregateExpressionUntyped
          }
        }
      | AggregateExpressionUntyped
    > & {
      _id: AggregateExpressionUntyped
    }
  >(
    groupSpecBuilder: (root: AggregateExpression<T>) => Spec
  ): MongoPipelineBuilder<{
    [K in keyof Spec]: K extends "_id"
      ? Spec[K] extends AggregateExpression<infer U>
        ? U
        : never
      : Spec[K] extends { $avg: AggregateExpression<number> }
      ? number
      : Spec[K] extends { $sum: AggregateExpression<number> }
      ? number
      : Spec[K] extends { $first: AggregateExpression<infer U> }
      ? U | null
      : Spec[K] extends { $count: {} }
      ? number
      : Spec[K] extends { $push: AggregateExpression<infer U> }
      ? readonly U[]
      : Spec[K] extends { $min: AggregateExpression<infer U> }
      ? U
      : Spec[K] extends { $max: AggregateExpression<infer U> }
      ? U
      : Spec[K] extends {
          $bottom: {
            sortBy: MongoSort<T>
            output: AggregateExpression<infer U>
          }
        }
      ? U
      : Spec[K] extends {
          $top: {
            sortBy: MongoSort<T>
            output: AggregateExpression<infer U>
          }
        }
      ? U
      : never
  }> {
    const groupSpec = groupSpecBuilder(
      buildAggregateExpression(this.type, "$$ROOT")
    )
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return new MongoPipelineBuilder(
      objectType(
        structEntries2(groupSpec).map((x) => {
          if (x[0] === "_id") {
            return {
              name: "_id",
              type: (x[1] as unknown as AggregateExpressionUntyped).buildType(),
            }
          }
          const y = x[1]
          if ("$avg" in y) {
            return { name: x[0] as string, type: doubleType }
          } else if ("$sum" in y) {
            return { name: x[0] as string, type: y.$sum.buildType() }
          } else if ("$first" in y) {
            return { name: x[0] as string, type: y.$first.buildType() }
          } else if ("$last" in y) {
            return { name: x[0] as string, type: y.$last.buildType() }
          } else if ("$count" in y) {
            return { name: x[0] as string, type: int32Type }
          } else if ("$push" in y) {
            return {
              name: x[0] as string,
              type: arrayType(y.$push.buildType()),
            }
          } else if ("$min" in y) {
            return {
              name: x[0] as string,
              type: y.$min.buildType(),
            }
          } else if ("$max" in y) {
            return {
              name: x[0] as string,
              type: y.$max.buildType(),
            }
          } else if ("$bottom" in y) {
            return {
              name: x[0] as string,
              type: y.$bottom.output.buildType(),
            }
          } else if ("$top" in y) {
            return {
              name: x[0] as string,
              type: y.$top.output.buildType(),
            }
          }
          throw abort("Invalid code flow")
        })
      ),
      [
        ...this.stageDocs,
        {
          $group: Object.fromEntries(
            structEntries2(groupSpec).map(([name, expr]) => {
              if (name === "_id") {
                return [
                  "_id",
                  (
                    expr as unknown as AggregateExpression<any>
                  ).buildMongoExpression(),
                ]
              }
              if ("$avg" in expr) {
                return [name, { $avg: expr.$avg.buildMongoExpression() }]
              } else if ("$sum" in expr) {
                return [name, { $sum: expr.$sum.buildMongoExpression() }]
              } else if ("$first" in expr) {
                return [name, { $first: expr.$first.buildMongoExpression() }]
              } else if ("$last" in expr) {
                return [name, { $last: expr.$last.buildMongoExpression() }]
              } else if ("$count" in expr) {
                return [name, { $count: {} }]
              } else if ("$push" in expr) {
                return [name, { $push: expr.$push.buildMongoExpression() }]
              } else if ("$min" in expr) {
                return [name, { $min: expr.$min.buildMongoExpression() }]
              } else if ("$max" in expr) {
                return [name, { $max: expr.$max.buildMongoExpression() }]
              } else if ("$bottom" in expr) {
                return [
                  name,
                  {
                    $bottom: {
                      sortBy: expr.$bottom.sortBy,
                      output: expr.$bottom.output.buildMongoExpression(),
                    },
                  },
                ]
              } else if ("$top" in expr) {
                return [
                  name,
                  {
                    $top: {
                      sortBy: expr.$top.sortBy,
                      output: expr.$top.output.buildMongoExpression(),
                    },
                  },
                ]
              }
              throw abort("Invalid code flow")
            })
          ),
        },
      ]
    ) as any
  }

  lookup<
    U extends { _id: unknown },
    LocalField extends Join<NestedPaths<T>, ".">,
    AS extends string
  >(lookupSpec: {
    from: MongoCollection<U>
    localField: LocalField
    foreignField: keyof {
      [K in Join<NestedPaths<U>, "."> as K extends string
        ? NonNullable<PropertyType<U, K>> extends AlternativeType<
            PropertyType<T, LocalField>
          >
          ? K
          : never
        : never]: undefined
    }
    as: AS
  }): MongoPipelineBuilder<T & Record<AS, readonly U[]>> {
    return new MongoPipelineBuilder(
      objectType([
        ...((
          asInstanceOrAbort(ObjectType, this.type) as ObjectType<
            CoreClosure,
            any
          >
        ).spec as ObjectSpec<any>),
        { name: lookupSpec.as, type: arrayType(lookupSpec.from.docType) },
      ]),
      [
        ...this.stageDocs,
        {
          $lookup: {
            from: lookupSpec.from.collectionName,
            localField: lookupSpec.localField,
            foreignField: lookupSpec.foreignField,
            as: lookupSpec.as,
          },
        },
      ]
    ) as unknown as MongoPipelineBuilder<T & Record<AS, readonly U[]>>
  }

  unwind<
    F extends keyof {
      [K in keyof T as NonNullable<T[K]> extends readonly unknown[]
        ? K
        : never]: undefined
    } &
      string
  >(
    field: F
  ): MongoPipelineBuilder<
    Omit<T, F> & {
      [K in F & keyof T]: NonNullable<T[K]> extends readonly (infer V)[]
        ? V
        : never
    }
  > {
    return new MongoPipelineBuilder(
      objectType(
        (
          (
            asInstanceOrAbort(ObjectType, this.type) as ObjectType<
              CoreClosure,
              any
            >
          ).spec as ObjectSpec<CoreClosure>
        ).map((spec) =>
          spec.name === field
            ? {
                name: field,
                type: getNullableArrayInnerTypeOrAbort(spec.type),
              }
            : spec
        )
      ),
      [
        ...this.stageDocs,
        {
          $unwind: {
            path: "$" + field,
          },
        },
      ]
    ) as unknown as MongoPipelineBuilder<
      Omit<T, F> & {
        [K in F & keyof T]: NonNullable<T[K]> extends readonly (infer V)[]
          ? V
          : never
      }
    >
  }
}
