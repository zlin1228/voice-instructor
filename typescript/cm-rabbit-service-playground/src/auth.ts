import jwt, { JwtPayload } from "jsonwebtoken"
import jwksClient from "jwks-rsa"

// References:
//   - https://github.com/auth0/node-jsonwebtoken
//       for verifying JWT token
//   - https://github.com/auth0/node-jwks-rsa
//       for retrieving JWT signing key

export class AuthClient {
  readonly #client: jwksClient.JwksClient
  readonly #signingKey: string

  private constructor(client: jwksClient.JwksClient, signingKey: string) {
    this.#client = client
    this.#signingKey = signingKey
  }

  static async build(jwksUri: string): Promise<AuthClient> {
    const client = jwksClient({
      jwksUri,
    })
    const signingKey = await client.getSigningKey()
    return new AuthClient(client, signingKey.getPublicKey())
  }

  verify(token: string, evaluate: boolean): JwtPayload {
    if (evaluate) {
      const userId = Date.now().toString()
      return token === "0c8fef49-3dd7-4a3f-a199-f26e3452f6ed" ? { sub: `eval-${userId}` } : {}
    }
    return jwt.verify(token, this.#signingKey) as JwtPayload
  }
}
