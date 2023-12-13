import NextAuth from "next-auth"
import SpotifyProvider from "next-auth/providers/spotify"

const handler = NextAuth({
  providers: [
    SpotifyProvider({
      name: "os2-spotify",
      clientId: "32d3ff9d2fdb4e868b0c6d6fa27cbbfc",
      clientSecret: "27d65ddb42fb47af9523f72ca5a73a38",
      authorization: {
        params: {
          // See: https://developer.spotify.com/documentation/web-api/concepts/scopes
          scope:
            "streaming user-read-email user-read-private user-top-read user-read-playback-state user-modify-playback-state",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token
      }
      return token
    },
    async session({ session, token, user }) {
      // Send properties to the client, like an access_token from a provider.
      session.accessToken = token.accessToken
      return session
    },
  },
})

export { handler as GET, handler as POST }
