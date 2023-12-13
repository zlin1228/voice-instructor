import mongodb, {
  Binary,
  Double,
  Int32,
  AbstractCursor,
  WithoutId,
  Filter,
} from "mongodb"
import { arrayLastOrUndefined } from "base-core/lib/array.js"
import { abortIfUndefined, asInstanceOrAbort } from "base-core/lib/debug.js"
import { log } from "base-core/lib/logging.js"
import { structEntries } from "base-core/lib/meta.js"
import { Scanner } from "base-core/lib/processing.js"
import {
  PendingValue,
  Scope,
  checkAndGetCancelToken,
} from "base-core/lib/scope.js"
import {
  ArrayType,
  BinaryClosure,
  BinaryType,
  BooleanType,
  CookType,
  DoubleType,
  Int32Type,
  MapType,
  NullableType,
  ObjectSpec,
  objectType,
  ObjectType,
  stringType,
  StringType,
  TimestampType,
  Type,
  TypeMapperIn,
  TypeVisitor,
} from "base-core/lib/types.js"
import {
  arrayNormalizerBuilder,
  binaryNormalizerBuilder,
  booleanNormalizerBuilder,
  buildNormalizer,
  CommonClosure,
  commonNormalizer,
  CoreClosure,
  coreNormalizer,
  doubleNormalizerBuilder,
  int32NormalizerBuilder,
  Normalizer,
  NormalizerBuilder,
  nullableNormalizerBuilder,
  objectNormalizerBuilder,
  stringNormalizerBuilder,
  timestampNormalizerBuilder,
} from "base-core/lib/types-common.js"
import { flyingPromise, isNotUndefined } from "base-core/lib/utils.js"
import {
  buildAggregateExpression,
  MongoFilter,
  MongoPipelineBuilder,
  MongoUpdate,
} from "./expressions.js"
import { OneOf } from "base-core/lib/one-of.js"
import { stringRandomSimpleName } from "base-core/lib/string.js"

export function withStringIdType<Spec extends ObjectSpec<CommonClosure>>(
  type: ObjectType<CommonClosure, Spec>
) {
  return objectType([{ name: "_id", type: stringType }, ...type.spec] as const)
}

export type WithStringId<T> = T & { readonly _id: string }

export function buildRandomStringId(): string {
  return stringRandomSimpleName(12).toUpperCase()
}

export type DocType<T extends { _id: unknown }> = Type<CoreClosure, T>

export type PartialDoc<T extends { _id: unknown }> = Partial<T> & Pick<T, "_id">

export function docTypeAsObjectType<T extends { _id: unknown }>(
  docType: DocType<T>
): ObjectType<CoreClosure, any> {
  return asInstanceOrAbort(ObjectType, docType) as ObjectType<CoreClosure, any>
}

export function getDocKeyType<T extends { _id: unknown }>(
  docType: DocType<T>
): Type<CoreClosure, T["_id"]> {
  return docTypeAsObjectType(docType).getFieldSpecUntyped("_id").type as Type<
    CoreClosure,
    T["_id"]
  >
}

const valueToBsonVisitor: TypeVisitor<CoreClosure, TypeMapperIn<unknown>> = {
  [StringType.symbol]: (type, value) => value,
  [DoubleType.symbol]: (type, value) => new Double(value),
  [Int32Type.symbol]: (type, value) => new Int32(value),
  [ObjectType.symbol]: (type, value) => {
    const entries = type
      .destructObject(value, (field, value) => {
        return value === undefined
          ? undefined
          : [field.name, valueToBson(field.type, value)]
      })
      .filter(isNotUndefined)
    return Object.fromEntries(entries) as unknown
  },
  [ArrayType.symbol]: (type, value) => {
    return value.map((v) => valueToBson(type.type, v))
  },
  [MapType.symbol]: (type, value) => {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, valueToBson(type.type, v)])
    )
  },
  [BooleanType.symbol]: (type, value) => value,
  [TimestampType.symbol]: (type, value) => value,
  [BinaryType.symbol]: (type, value) => new Binary(value),
  [NullableType.symbol]: (type, value) =>
    value === null ? undefined : valueToBson(type.type, value),
}

function valueToBson<T>(type: Type<CoreClosure, T>, value: T): unknown {
  return type.extractValue(value, valueToBsonVisitor)
}

// function partialValueToBson<T>(type: Type<CoreClosure, T>, value: T): unknown {
//   return Object.fromEntries(
//     (asInstanceOrAbort(ObjectType, type) as ObjectType<CoreClosure, any>)
//       .destructObject<[string, unknown] | undefined>(
//         value as any,
//         (field, value) => {
//           return value === undefined || value === null
//             ? undefined
//             : [field.name, valueToBson(field.type, value)]
//         }
//       )
//       .filter(isNotUndefined)
//   ) as unknown
// }

function docToBson<T extends { _id: unknown }>(
  type: DocType<T>,
  value: T
): { _id: unknown } & Record<string, unknown> {
  return valueToBson<T>(type, value) as { _id: unknown } & Record<
    string,
    unknown
  >
}

function partialDocToBson<T extends { _id: unknown }>(
  type: DocType<T>,
  value: PartialDoc<T>
): { _id: unknown } & Record<string, unknown> {
  return Object.fromEntries(
    (asInstanceOrAbort(ObjectType, type) as ObjectType<CoreClosure, any>)
      .destructObject<[string, unknown] | undefined>(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        value as any,
        (field, value) => {
          return value === undefined || value === null
            ? undefined
            : [field.name, valueToBson(field.type, value)]
        }
      )
      .filter(isNotUndefined)
  ) as { _id: unknown } & Record<string, unknown>
}

function binaryFromMongoNormalizerBuilder<
  C extends BinaryClosure
>(): NormalizerBuilder<C> {
  return (upstream, normalizer) =>
    <T>(type: Type<C, T>, value: unknown): T => {
      if (type.symbol === BinaryType.symbol && value instanceof Binary) {
        return upstream(type, value.buffer)
      }
      return upstream(type, value)
    }
}

const mongoNormalizer: Normalizer<CoreClosure> = buildNormalizer([
  stringNormalizerBuilder(),
  doubleNormalizerBuilder(),
  int32NormalizerBuilder(),
  booleanNormalizerBuilder(),
  timestampNormalizerBuilder(),
  binaryNormalizerBuilder(),
  objectNormalizerBuilder({ extraObjectProperties: "strip" }),
  arrayNormalizerBuilder(),
  nullableNormalizerBuilder(),
  binaryFromMongoNormalizerBuilder(),
])

function bsonToDoc<T>(type: Type<CoreClosure, T>, bson: unknown): T {
  return mongoNormalizer<T>(type, bson)
}

function buildIdFilter<T extends { _id: unknown }>(
  type: DocType<T>,
  id: T["_id"]
): MongoFilter<T> {
  return {
    _id: valueToBson(getDocKeyType(type), id),
  } as MongoFilter<T>
}

export class MongoCursor<T> {
  #type: Type<CoreClosure, T>
  #cursor: AbstractCursor
  constructor(type: Type<CoreClosure, T>, cursor: AbstractCursor) {
    this.#type = type
    this.#cursor = cursor
  }
  async toArray(): Promise<T[]> {
    return ((await this.#cursor.toArray()) as unknown[]).map((bson) =>
      bsonToDoc(this.#type, bson)
    )
  }
  iterate() {
    return this[Symbol.asyncIterator]()
  }
  [Symbol.asyncIterator](): AsyncIterator<T, void> {
    const cursor = this.#cursor
    const type = this.#type
    return (async function* () {
      for await (const bson of cursor) {
        yield bsonToDoc(type, bson)
      }
    })()
  }
}
export type DocArrayFields<T extends { _id: unknown }> = {
  [K in keyof T]: T[K] extends readonly (infer V)[] ? V : never
}

export class MongoCollection<T extends { _id: unknown }> {
  #collection: mongodb.Collection
  #docType: DocType<T>

  constructor(collection: mongodb.Collection, docType: DocType<T>) {
    this.#collection = collection
    this.#docType = docType
  }

  get collectionName(): string {
    return this.#collection.collectionName
  }

  get docType(): DocType<T> {
    return this.#docType
  }

  find(scope: Scope, mongoFilter: MongoFilter<T>): Scanner<T> {
    return this.findAs<T>(scope, mongoFilter, this.#docType)
  }

  findAs<U extends T>(
    scope: Scope,
    mongoFilter: MongoFilter<T>,
    type: Type<CoreClosure, U>
  ): Scanner<U> {
    const estimateCount = async () => {
      const total = await this.#collection.estimatedDocumentCount()
      if (total < 2000000) return undefined
      const countDocs = await this.#collection
        .aggregate([
          {
            $sample: { size: 100000 },
          },
          {
            $match: mongoFilter,
          },
          {
            $count: "count",
          },
        ])
        .toArray()
      const count = countDocs[0]?.["count"] as unknown
      if (typeof count === "number") return Math.ceil((count / 100000) * total)
      return undefined
    }
    let estimatingPromise: Promise<number | undefined> | undefined
    let count: number | undefined
    const thiz = this
    return new Scanner(
      (async function* () {
        for await (const bson of thiz.#collection.find(mongoFilter)) {
          yield bsonToDoc(type, bson)
        }
        await estimatingPromise
      })(),
      () => {
        if (estimatingPromise === undefined) {
          estimatingPromise = estimateCount()
          flyingPromise(async () => {
            count = await estimatingPromise
          })
        }
        return count
      }
    )
  }

  findFewAs<U extends T>(
    scope: Scope,
    mongoFilter: MongoFilter<T>,
    type: Type<CoreClosure, U>
  ): Scanner<U> {
    const thiz = this
    return new Scanner(
      (async function* () {
        for await (const bson of thiz.#collection.find(mongoFilter)) {
          yield bsonToDoc(type, bson)
        }
      })(),
      () => undefined
    )
  }

  async findOne(
    scope: Scope,
    mongoFilter: MongoFilter<T>
  ): Promise<T | undefined> {
    return this.findOneAs(scope, mongoFilter, this.#docType)
  }

  async findOneAs<U extends T>(
    scope: Scope,
    mongoFilter: MongoFilter<T>,
    type: Type<CoreClosure, U>
  ): Promise<U | undefined> {
    const bson = await this.#collection.findOne(mongoFilter)
    if (bson === null) return undefined
    return bsonToDoc(type, bson)
  }

  async getById(scope: Scope, id: T["_id"]): Promise<T | undefined> {
    return await this.findOne(scope, buildIdFilter(this.#docType, id))
  }

  async getByIdAs<U extends T>(
    scope: Scope,
    id: T["_id"],
    type: Type<CoreClosure, U>
  ): Promise<U | undefined> {
    return await this.findOneAs(scope, buildIdFilter(this.#docType, id), type)
  }

  aggregate<R extends {}>(
    scope: Scope,
    pipeline: (
      pipelineBuilder: MongoPipelineBuilder<T>
    ) => MongoPipelineBuilder<R>
  ): Scanner<R> {
    const { type, stageDocs } = pipeline(
      new MongoPipelineBuilder(this.#docType, [])
    )
    // console.log(JSON.stringify(stageDocs, null, 2))

    const estimateCount = async () => {
      if (
        !stageDocs.every((stage) => {
          return ["$match", "$project", "$sort", "$limit", "$lookup"].some(
            (op) => op in stage
          )
        })
      ) {
        return undefined
      }
      const lastLimitStage = arrayLastOrUndefined(
        stageDocs.filter((stage) => "$limit" in stage)
      )
      if (lastLimitStage !== undefined) {
        const limit = lastLimitStage["$limit"] as unknown
        if (typeof limit === "number") {
          return limit
        }
        return undefined
      }
      const total = await this.#collection.estimatedDocumentCount()
      if (total < 2000000) return undefined
      const countDocs = await this.#collection
        .aggregate([
          {
            $sample: { size: 100000 },
          },
          ...stageDocs,
          {
            $count: "count",
          },
        ])
        .toArray()
      const count = countDocs[0]?.["count"] as unknown
      if (typeof count === "number") return Math.ceil((count / 100000) * total)
      return undefined
    }
    let estimatingPromise: Promise<number | undefined> | undefined
    let count: number | undefined
    const thiz = this
    return new Scanner(
      (async function* () {
        for await (const bson of thiz.#collection.aggregate(stageDocs)) {
          yield bsonToDoc(type, bson)
        }
        await estimatingPromise
      })(),
      () => {
        if (estimatingPromise === undefined) {
          estimatingPromise = estimateCount()
          flyingPromise(async () => {
            count = await estimatingPromise
          })
        }
        return count
      }
    )
  }

  async merge<
    U extends { _id: unknown },
    V extends Partial<U> & Pick<U, "_id">
  >(
    scope: Scope,
    into: MongoCollection<U>,
    pipeline: (
      pipelineBuilder: MongoPipelineBuilder<T>
    ) => MongoPipelineBuilder<V>
  ): Promise<void> {
    const { type, stageDocs } = pipeline(
      new MongoPipelineBuilder(this.#docType, [])
    )
    // console.log(JSON.stringify(stageDocs, null, 2))
    const resp = await this.#collection
      .aggregate([
        ...stageDocs,
        {
          $merge: {
            into: into.collectionName,
            on: "_id",
            whenMatched: "merge",
            whenNotMatched: "discard",
          },
        },
      ])
      .toArray()
    console.log(resp)
  }

  async out<U extends { _id: unknown }>(
    scope: Scope,
    coll: MongoCollection<U>,
    pipeline: (
      pipelineBuilder: MongoPipelineBuilder<T>
    ) => MongoPipelineBuilder<U>
  ): Promise<void> {
    const { type, stageDocs } = pipeline(
      new MongoPipelineBuilder(this.#docType, [])
    )
    // console.log(JSON.stringify(stageDocs, null, 2))
    const resp = await this.#collection
      .aggregate([
        ...stageDocs,
        {
          $out: coll.collectionName,
        },
      ])
      .toArray()
    console.log(resp)
  }

  async bulkCreateOrReplace(scope: Scope, docs: readonly T[]): Promise<void> {
    if (docs.length === 0) return
    const operations = docs.map((doc) => {
      const bson = docToBson(this.#docType, doc)
      const { _id, ...rest } = bson
      return {
        replaceOne: {
          filter: {
            _id: _id as Filter<T>,
          },
          replacement: rest as WithoutId<T>,
          upsert: true,
        },
      }
    })
    await this.#collection.bulkWrite(operations, {
      ordered: false,
    })
  }

  async bulkMergeFields(
    scope: Scope,
    docs: readonly (Partial<T> & Pick<T, "_id">)[]
  ): Promise<void> {
    if (docs.length === 0) return
    const operations = docs.map((doc) => {
      const bson = partialDocToBson(this.#docType, doc)
      const { _id, ...rest } = bson
      return {
        updateOne: {
          filter: { _id },
          update: { $set: rest },
        },
      }
    })
    await this.#collection.bulkWrite(operations as any, {
      ordered: false,
    })
  }
  async createOrReplace(scope: Scope, doc: T): Promise<void> {
    const bson = docToBson(this.#docType, doc)
    const { _id, ...rest } = bson
    await this.#collection.replaceOne(
      {
        _id,
      } as any,
      rest as WithoutId<T>,
      {
        upsert: true,
      }
    )
  }

  async createOrAppendArray<F extends keyof DocArrayFields<T>>(
    scope: Scope,
    doc: T,
    field: F
  ): Promise<void> {
    const bson = docToBson(this.#docType, doc)
    const { [field]: fieldValue, ...mongoDocWithoutField } = bson
    await this.#collection.updateOne(
      { _id: bson._id } as any,
      {
        $setOnInsert: mongoDocWithoutField,
        $push: { [field]: { $each: fieldValue } },
      },
      { upsert: true }
    )
  }

  async createIfNotExists(scope: Scope, doc: T): Promise<boolean> {
    const bson = docToBson(this.#docType, doc)
    const result = await this.#collection.updateOne(
      {
        _id: bson._id,
      } as any,
      { $setOnInsert: bson },
      {
        upsert: true,
      }
    )
    return result.upsertedCount === 1
  }

  async deleteOne(scope: Scope, mongoFilter: MongoFilter<T>): Promise<void> {
    await this.#collection.deleteOne(mongoFilter)
  }

  async deleteById(scope: Scope, id: T["_id"]): Promise<void> {
    await this.deleteOne(scope, buildIdFilter(this.#docType, id))
  }

  async updateOne(
    scope: Scope,
    mongoFilter: MongoFilter<T>,
    mongoUpdate: MongoUpdate<T>
  ): Promise<boolean> {
    const setOp =
      mongoUpdate["$set"] === undefined
        ? undefined
        : {
            $set: Object.fromEntries(
              structEntries(mongoUpdate["$set"]).map(([key, value]) => {
                // const bson = valueToBson<T>(
                //   docTypeAsObjectType(this.#docType).getFieldSpecUntyped(key)
                //     .type,
                //   value as any
                // )
                // return [key, bson] as const
                return [key, value] as const
              })
            ),
          }
    const unsetOp =
      mongoUpdate["$unset"] === undefined
        ? undefined
        : {
            $unset: mongoUpdate["$unset"],
          }
    const result = await this.#collection.updateOne(mongoFilter, {
      ...setOp,
      ...unsetOp,
    })
    return result.matchedCount === 1
  }

  async updateById(
    scope: Scope,
    id: T["_id"],
    mongoUpdate: MongoUpdate<T>
  ): Promise<void> {
    const updated = await this.updateOne(
      scope,
      buildIdFilter(this.#docType, id),
      mongoUpdate
    )
    if (!updated) {
      throw new Error(`Failed to update - id=[${String(id)}]`)
    }
  }

  async updateMany(
    scope: Scope,
    mongoFilter: MongoFilter<T>,
    mongoUpdate: MongoUpdate<T>
  ): Promise<number> {
    const setOp =
      mongoUpdate["$set"] === undefined
        ? undefined
        : {
            $set: Object.fromEntries(
              structEntries(mongoUpdate["$set"]).map(([key, value]) => {
                // const bson = valueToBson<T>(
                //   docTypeAsObjectType(this.#docType).getFieldSpecUntyped(key)
                //     .type,
                //   value as any
                // )
                // return [key, bson] as const
                return [key, value] as const
              })
            ),
          }
    const unsetOp =
      mongoUpdate["$unset"] === undefined
        ? undefined
        : {
            $unset: mongoUpdate["$unset"],
          }
    const result = await this.#collection.updateMany(mongoFilter, {
      ...setOp,
      ...unsetOp,
    })
    return result.matchedCount as number
  }

  async clearFieldForAllDocs(
    scope: Scope,
    key: {
      [K in keyof T]: K extends "_id"
        ? never
        : undefined extends T[K]
        ? K
        : never
    }[keyof T]
  ): Promise<void> {
    await this.updateMany(
      scope,
      {
        [key]: { $ne: null },
      } as MongoFilter<T>,
      {
        $unset: { [key]: "" },
      } as MongoUpdate<T>
    )
  }

  async *findAndWatch<R extends {}>(
    scope: Scope,
    pipeline: (
      pipelineBuilder: MongoPipelineBuilder<T>
    ) => MongoPipelineBuilder<R>
  ): AsyncGenerator<
    OneOf<{
      create: R
      update: R
      delete: T["_id"]
    }>
  > {
    const { type, stageDocs } = pipeline(
      new MongoPipelineBuilder(this.#docType, [])
    )
    const cancelToken = checkAndGetCancelToken(scope)
    const changeStream = this.#collection.watch(stageDocs, {
      fullDocument: "updateLookup",
    })
    cancelToken.onCancel(async () => {
      await changeStream.close()
    })
    try {
      for await (const change of changeStream) {
        if (change.operationType === "delete") {
          yield { kind: "delete", value: change.documentKey._id }
        } else if (change.operationType === "insert") {
          yield { kind: "create", value: bsonToDoc(type, change.fullDocument) }
        } else if (change.operationType === "replace") {
          yield { kind: "update", value: bsonToDoc(type, change.fullDocument) }
        } else if (change.operationType === "update") {
          yield { kind: "update", value: bsonToDoc(type, change.fullDocument) }
        }
      }
    } catch (e) {
      if (e instanceof mongodb.MongoAPIError) {
        if (cancelToken.cancelReason !== undefined) {
          return
        }
      }
      throw e
    }
  }
}

export class MongoDbClient {
  constructor(
    private readonly mongoClient: mongodb.MongoClient,
    private readonly database: string,
    private readonly prefix: string
  ) {}

  accessCollection<T extends { _id: unknown }>(
    name: string,
    docType: DocType<T>
  ): MongoCollection<T> {
    return new MongoCollection<T>(
      this.mongoClient
        .db(this.database)
        .collection(`${this.prefix === "" ? "" : `${this.prefix}-`}${name}`),
      docType
    )
  }
}
