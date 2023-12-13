import "server-only"

export const runtime = 'nodejs'

import { NextResponse } from "next/server"

import { commonNormalizer } from "base-core/lib/types-common"

export async function GET(request: Request) {
  return NextResponse.json({
    what: "hello!",
  })
}
