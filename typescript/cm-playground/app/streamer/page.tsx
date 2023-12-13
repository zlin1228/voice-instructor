"use client"

import { Scope } from "base-core/lib/scope.js"
import { flyingPromise } from "base-core/lib/utils.js"

import { testStreamer } from "../../src/streamer/client"
import { testBrowsingMinion } from "../../src/browsing-minion/browsing-minion"

export default function Streamer() {
  return (
    <div>
      <h1>Streamer</h1>
      <button
        onClick={() => {
          flyingPromise(async () => {
            await Scope.with(undefined, [], async (scope) => {
              // await testStreamer(scope)
              await testBrowsingMinion(scope)
            })
          })
        }}
      >
        Test
      </button>
      <br />
      <audio id="audio" autoPlay controls></audio>
    </div>
  )
}
