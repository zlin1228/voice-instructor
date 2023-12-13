import { NextResponse } from "next/server"

import { authMiddleware } from "@clerk/nextjs"

export default authMiddleware({
  afterAuth: (auth, req) => {
    // By default, Clerk redirects the request to sign in page if the user is not signed in.
    // We disable this behavior and redirect the user to sign in page from individual component.
    // Note that Clerk determins the redirect URL from req.url which has the wrong origin in
    // development mode if running behind a reverse proxy.
    return NextResponse.next()
  },
})

export const config = {
  // The Clerk official doc says the second element of the array is "/'" as of 05/12/2023.
  // This doesn't look right to me (Zhuoheng).
  // https://clerk.com/docs/nextjs/middleware
  matcher: ["/((?!.*\\..*|_next).*)", "/"],
}
