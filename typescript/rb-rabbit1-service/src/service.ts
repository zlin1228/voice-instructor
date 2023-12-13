import { OneOf } from "base-core/lib/one-of.js"
import { Scope, sleepUntilCancel } from "base-core/lib/scope.js"
import { Rabbit1HttpService } from "rb-rabbit1-common/lib/schema.js"
import { buildAsyncGenerator } from "base-core/lib/processing.js"
import { throwError } from "base-core/lib/exception.js"
import { buildRandomStringId } from "base-mongodb/lib/mongodb.js"

export type OrganizationKeyMap = Map<string, string>

export interface RabbitCompanionService extends Rabbit1HttpService {}

export async function buildRabbitCompanionService(
  scope: Scope
): Promise<RabbitCompanionService> {
  return {
    post_test: async (scope, request) => {
      return {
        responseData: request.requestData,
      }
    },
  }
}
