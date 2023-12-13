
import { ModelClient } from "./model.js"

export class AuthClient {
  readonly #client: ModelClient

  private constructor(client: ModelClient) {
    this.#client = client
  }

  static async build(client: ModelClient): Promise<AuthClient> {
    return new AuthClient(client)
  }

  async verify(token: string): Promise<string | undefined> {
    const scope = this.#client.scope
    const apiDoc = await this.#client.apiStorageCollection.getById(scope, token)
    return apiDoc ? apiDoc._id : undefined
  }
}
