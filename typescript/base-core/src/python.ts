import {
  ArrayType,
  BinaryType,
  BooleanType,
  DoubleType,
  Int32Type,
  MapType,
  NullableType,
  ObjectSpec,
  ObjectType,
  StringType,
  TimestampType,
  Type,
  ValidationError,
} from "./types.js"
import { CoreClosure } from "./types-common.js"

interface ClassType {
  name: string
  definition: string
}

export class PydanticModelBuilder {
  readonly #knownClasses = new Map<ObjectType<CoreClosure, any>, ClassType>()
  #nextClassId = 0
  readonly #exportTypes: { externalName: string; internalName: string }[] = []

  private buildClassType<Spec extends ObjectSpec<CoreClosure>>(
    type: ObjectType<CoreClosure, Spec>
  ): ClassType {
    const classId = ++this.#nextClassId
    const name = `ObjectType_${classId}`
    const classType: ClassType = {
      name,
      definition: "",
    }
    let s = ``
    s += `class ${name}(pydantic.BaseModel):\n`
    type.visitFields((fieldSpec) => {
      if (fieldSpec.optional) {
        s += `    ${fieldSpec.name}: ${this.getTypeName(
          fieldSpec.type
        )} = None\n`
      } else {
        s += `    ${fieldSpec.name}: ${this.getTypeName(fieldSpec.type)}\n`
      }
    })
    s += `\n`
    s += `\n`
    classType.definition = s
    this.#knownClasses.set(type, classType)
    return classType
  }

  private getTypeName<T>(type: Type<CoreClosure, T>): string {
    return type.visitType<string>({
      [StringType.symbol]: (type): string => {
        return "str"
      },
      [DoubleType.symbol]: (): string => {
        return "float"
      },
      [Int32Type.symbol]: (): string => {
        return "pydantic.StrictInt"
      },
      [TimestampType.symbol]: (): string => {
        return "datetime.datetime"
      },
      [ObjectType.symbol]: (type) => {
        const classType = this.#knownClasses.get(type)
        if (classType !== undefined) return classType.name
        return this.buildClassType(type).name
      },
      [ArrayType.symbol]: (type): string => {
        return `typing.List[${this.getTypeName(type.type)}]`
      },
      [MapType.symbol]: (type): string => {
        return `typing.Dict[str, ${this.getTypeName(type.type)}]`
      },
      [BooleanType.symbol]: (type): string => {
        return "bool"
      },
      [BinaryType.symbol]: (type): string => {
        throw new Error("Cannot build Pydantic file for binary data type")
      },
      [NullableType.symbol]: (type) => {
        return `typing.Optional[${this.getTypeName(type.type)}]`
      },
    })
  }

  addType<T>(name: string, type: Type<CoreClosure, T>) {
    const internalName = this.getTypeName(type)
    this.#exportTypes.push({ internalName, externalName: name })
  }

  build(): string {
    let s = ""
    s += "import pydantic\n"
    s += "import typing\n"
    s += "import datetime\n"
    s += "\n"
    s += `\n`
    for (const classType of this.#knownClasses.values()) {
      s += classType.definition
    }
    for (const exportType of this.#exportTypes) {
      s += `${exportType.externalName} = ${exportType.internalName}\n`
    }
    return s
  }
}

export function buildPydanticModel<T>(
  name: string,
  type: Type<CoreClosure, T>
): string {
  let out = ""
  out += `class $name(BaseModel):`

  return out
}
