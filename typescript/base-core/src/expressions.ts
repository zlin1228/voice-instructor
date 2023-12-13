export abstract class Expression<T> {
  _enforceTypeInvariant: ((t: T) => T) | undefined = undefined
}

export function expressionAsSuper<T extends U, U>(
  expression: Expression<T>
): Expression<U> {
  return expression as unknown as Expression<U>
}

export function expressionAsSub<T, U extends T>(
  expression: Expression<T>
): Expression<U> {
  return expression as unknown as Expression<U>
}

export class ExpressionVariable<T> extends Expression<T> {
  constructor(public readonly name: string) {
    super()
  }
}

export class ExpressionAnd extends Expression<boolean> {
  constructor(
    public readonly expression0: Expression<boolean>,
    public readonly expression1: Expression<boolean>
  ) {
    super()
  }
}

export class ExpressionOr extends Expression<boolean> {
  constructor(
    public readonly expression0: Expression<boolean>,
    public readonly expression1: Expression<boolean>
  ) {
    super()
  }
}

export class ExpressionNot extends Expression<boolean> {
  constructor(public readonly expression: Expression<boolean>) {
    super()
  }
}

export class ExpressionEqual<T> extends Expression<boolean> {
  constructor(
    public readonly expression0: Expression<T>,
    public readonly expression1: Expression<T>
  ) {
    super()
  }
}

export class ExpressionNotEqual<T> extends Expression<boolean> {
  constructor(
    public readonly expression0: Expression<T>,
    public readonly expression1: Expression<T>
  ) {
    super()
  }
}

export class ExpressionLessThan<
  T extends string | number | Date
> extends Expression<boolean> {
  constructor(
    public readonly expression0: Expression<T>,
    public readonly expression1: Expression<T>
  ) {
    super()
  }
}

export class ExpressionLessThanOrEqual<
  T extends string | number | Date
> extends Expression<boolean> {
  constructor(
    public readonly expression0: Expression<T>,
    public readonly expression1: Expression<T>
  ) {
    super()
  }
}

export class ExpressionGreaterThan<
  T extends string | number | Date
> extends Expression<boolean> {
  constructor(
    public readonly expression0: Expression<T>,
    public readonly expression1: Expression<T>
  ) {
    super()
  }
}

export class ExpressionGreaterThanOrEqual<
  T extends string | number | Date
> extends Expression<boolean> {
  constructor(
    public readonly expression0: Expression<T>,
    public readonly expression1: Expression<T>
  ) {
    super()
  }
}

export class ExpressionIfNullish<T> extends Expression<T> {
  constructor(
    public readonly expression0: Expression<T | null | undefined>,
    public readonly expression1: Expression<T>
  ) {
    super()
  }
}

export class ExpressionIsNullish<T> extends Expression<boolean> {
  constructor(public readonly expression: Expression<T | null | undefined>) {
    super()
  }
}

export class ExpressionIsNotNullish<T> extends Expression<boolean> {
  constructor(public readonly expression: Expression<T | null | undefined>) {
    super()
  }
}

export class ExpressionLiteral<T> extends Expression<T> {
  constructor(public readonly value: T) {
    super()
  }
}

export class ExpressionRegexMatch extends Expression<boolean> {
  constructor(
    public readonly expression: Expression<string>,
    public readonly regex: string
  ) {
    super()
  }
}

export class ExpressionObjectField<
  T,
  K extends keyof T & string
> extends Expression<
  T[K] & (undefined | null) extends never ? T[K] : T[K] | null | undefined
> {
  constructor(
    public readonly expression: Expression<T>,
    public readonly field: K
  ) {
    super()
  }
  get fieldAsString(): string {
    return this.field
  }
}

export class ExpressionObjectHasField<
  T,
  K extends keyof T & string
> extends Expression<boolean> {
  constructor(
    public readonly expression: Expression<T>,
    public readonly field: K
  ) {
    super()
  }
  get fieldAsString(): string {
    return this.field
  }
}

export class ExpressionNullableObjectField<
  T,
  K extends keyof T & string
> extends Expression<T[K] | null | undefined> {
  constructor(
    public readonly expression: Expression<T | null | undefined>,
    public readonly field: K
  ) {
    super()
  }
  get fieldAsString(): string {
    return this.field
  }
}

export class ExpressionArrayLength<T> extends Expression<number> {
  constructor(public readonly expression: Expression<readonly T[]>) {
    super()
  }
}

export class ExpressionArrayLast<T> extends Expression<T | null | undefined> {
  constructor(public readonly expression: Expression<readonly T[]>) {
    super()
  }
}

export class ExpressionArrayFilter<T> extends Expression<boolean> {
  constructor(
    public readonly arrayExpression: Expression<readonly T[]>,
    public readonly elementVariable: string,
    public readonly conditionExpression: Expression<boolean>
  ) {
    super()
  }
}

class FluentExprImpl {
  constructor(public readonly expression: Expression<any>) {}

  logicalAnd(expr: FluentExprImpl): FluentExprImpl {
    return new FluentExprImpl(
      new ExpressionAnd(
        this.expression as Expression<boolean>,
        expr.expression as Expression<boolean>
      )
    )
  }

  logicalOr(expr: FluentExprImpl): FluentExprImpl {
    return new FluentExprImpl(
      new ExpressionOr(
        this.expression as Expression<boolean>,
        expr.expression as Expression<boolean>
      )
    )
  }

  logicalNot(): FluentExprImpl {
    return new FluentExprImpl(
      new ExpressionNot(this.expression as Expression<boolean>)
    )
  }

  objectField(field: string): FluentExprImpl {
    return new FluentExprImpl(new ExpressionObjectField(this.expression, field))
  }

  objectHasField(field: string): FluentExprImpl {
    return new FluentExprImpl(
      new ExpressionObjectHasField(this.expression, field)
    )
  }

  nullableObjectField(field: string): FluentExprImpl {
    return new FluentExprImpl(
      new ExpressionNullableObjectField(this.expression, field)
    )
  }

  eqLiteral(value: unknown): FluentExprImpl {
    return new FluentExprImpl(
      new ExpressionEqual(this.expression, new ExpressionLiteral(value))
    )
  }

  gtLiteral(value: string | number | Date): FluentExprImpl {
    return new FluentExprImpl(
      new ExpressionGreaterThan(this.expression, new ExpressionLiteral(value))
    )
  }

  nullOr(value: unknown): FluentExprImpl {
    return new FluentExprImpl(
      new ExpressionIfNullish(this.expression, new ExpressionLiteral(value))
    )
  }

  isNull(value: unknown): FluentExprImpl {
    return new FluentExprImpl(new ExpressionIsNullish(this.expression))
  }

  isNotNull(value: unknown): FluentExprImpl {
    return new FluentExprImpl(new ExpressionIsNotNullish(this.expression))
  }

  arrayLength(): FluentExprImpl {
    return new FluentExprImpl(
      new ExpressionArrayLength(
        this.expression as Expression<readonly unknown[]>
      )
    )
  }

  arrayLast(): FluentExprImpl {
    return new FluentExprImpl(
      new ExpressionArrayLast(this.expression as Expression<readonly unknown[]>)
    )
  }

  arrayFilter(
    variableName: string,
    predicate: (
      elementExpression: FluentExpression<any>
    ) => FluentExpression<boolean>
  ): FluentExprImpl {
    const exprVar = new ExpressionVariable(variableName)
    const exprFilter = predicate(
      new FluentExprImpl(exprVar) as unknown as FluentExpression<any>
    )
    return new FluentExprImpl(
      new ExpressionArrayFilter(
        this.expression as Expression<readonly unknown[]>,
        variableName,
        exprFilter.expression
      )
    )
  }

  regexMatch(regex: string): FluentExprImpl {
    return new FluentExprImpl(
      new ExpressionRegexMatch(this.expression as Expression<string>, regex)
    )
  }
}

export type FluentExpression<T> = {
  readonly expression: Expression<T>
} & ([T] extends [boolean]
  ? {
      logicalAnd: (
        this: FluentExpression<boolean>,
        expr: FluentExpression<boolean>
      ) => FluentExpression<boolean>
      logicalOr: (
        this: FluentExpression<boolean>,
        expr: FluentExpression<boolean>
      ) => FluentExpression<boolean>
      logicalNot: (this: FluentExpression<boolean>) => FluentExpression<boolean>
    }
  : {}) &
  ([T] extends [{ [key: string]: unknown }]
    ? {
        objectField: <K extends keyof T & string>(
          this: FluentExpression<T>,
          field: K
        ) => FluentExpression<
          T[K] & (undefined | null) extends never
            ? T[K]
            : T[K] | null | undefined
        >
      }
    : [T] extends [{ [key: string]: unknown } | undefined | null]
    ? {
        nullableObjectField: <K extends keyof NonNullable<T> & string>(
          this: FluentExpression<T>,
          field: K
        ) => FluentExpression<NonNullable<T>[K] | null | undefined>
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
        eqLiteral: (
          this: FluentExpression<T>,
          value: T
        ) => FluentExpression<boolean>
      }
    : {}) &
  ([T] extends [string] | [number] | [Date]
    ? {
        gtLiteral: (
          this: FluentExpression<T>,
          value: T
        ) => FluentExpression<boolean>
      }
    : {}) &
  ([undefined | null] extends [T]
    ? {
        nullOr: (
          this: FluentExpression<T>,
          value: NonNullable<T>
        ) => FluentExpression<NonNullable<T>>
        isNull: (this: FluentExpression<T>) => FluentExpression<boolean>
        isNotNull: (this: FluentExpression<T>) => FluentExpression<boolean>
      }
    : {}) &
  ([T] extends [readonly (infer V)[] | null | undefined]
    ? {
        arrayLength: (this: FluentExpression<T>) => FluentExpression<number>
        arrayLast: (
          this: FluentExpression<T>
        ) => FluentExpression<V | undefined | null>
        arrayFilter: (
          this: FluentExpression<T>,
          variableName: string,
          predicate: (
            elementExpression: FluentExpression<V>
          ) => FluentExpression<boolean>
        ) => FluentExpression<V[]>
      }
    : {}) &
  ([T] extends [string]
    ? {
        regexMatch: (
          this: FluentExpression<T>,
          regex: string
        ) => FluentExpression<boolean>
      }
    : {})

export function fluentExpression<T>(
  expression: Expression<T>
): FluentExpression<T> {
  return new FluentExprImpl(expression) as unknown as FluentExpression<T>
}
