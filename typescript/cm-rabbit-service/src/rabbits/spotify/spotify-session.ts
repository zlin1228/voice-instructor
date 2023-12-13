import {
  Os2ClientMessageSpotify,
  Os2ClientMessageSpotifyLogInStatus,
  Os2ClientMessageSpotifyLoginInitiate,
  Os2ClientMessageSpotifyPlayerConnect,
  Os2ServerMessageSpotify,
} from "cm-rabbit-common/lib/session/session-spotify.js"

import { SpotifyClient } from "./spotify-client.js"
import {
  BroadcastController,
  Scope,
  buildAttachmentForCancellation,
  sleepUntilCancel,
} from "base-core/lib/scope.js"
import { log } from "base-core/lib/logging.js"
import {
  Os2SpotifyPlayerControl,
  Os2SpotifyPlayerStatus,
} from "cm-rabbit-common/lib/spotify/spotify.js"

export class SpotifySession {
  #spotifyClient: SpotifyClient
  #pushServerMessage: (message: Os2ServerMessageSpotify) => void
  #loginStorageAvailable: boolean | undefined
  #playerStatusBroadcast = new BroadcastController<Os2SpotifyPlayerStatus>()
  #playerStatus: Os2SpotifyPlayerStatus | undefined
  #loginState:
    | {
      cancel: (error: Error) => void
    }
    | undefined
  #playerState:
    | {
      cancel: (error: Error) => void
      playerController:
      | ((playerControl: Os2SpotifyPlayerControl) => void)
      | undefined
    }
    | undefined
  #storageFetcher: (scope: Scope) => Promise<string>
  #storagePusher: (scope: Scope, storage: string) => Promise<void>

  constructor(
    spotifyClient: SpotifyClient,
    pushServerMessage: (message: Os2ServerMessageSpotify) => void,
    storageFetcher: (scope: Scope) => Promise<string>,
    storagePusher: (scope: Scope, storage: string) => Promise<void>
  ) {
    this.#spotifyClient = spotifyClient
    this.#pushServerMessage = pushServerMessage
    this.#storageFetcher = storageFetcher
    this.#storagePusher = storagePusher
  }

  async #handleLogInStatus(
    scope: Scope,
    logInStatus: Os2ClientMessageSpotifyLogInStatus
  ) {
    this.#loginStorageAvailable = logInStatus.storageAvailable
  }

  // true: User reported that the Spotify cookies were available on the browser local storage
  // false: User reported that the Spotify cookies were not available on the browser local storage
  // undefined: User hasn't reported yet.
  isLoginStorageAvailable(): boolean | undefined {
    return this.#loginStorageAvailable
  }

  async isLoginStorageAvailableServer(scope: Scope): Promise<boolean> {
    try {
      const token = await this.#storageFetcher(scope)
      console.log("[isLoginStorageAvailableServer token]: ", token)
      return token !== "" && token !== undefined && token !== null
    } catch (e) {
      console.log("[isLoginStorageAvailableServer error]: ", e)
      return false
    }
  }

  async getLoginStorage(scope: Scope): Promise<string> {
    try {
      const token = await this.#storageFetcher(scope)
      return token
    } catch (e) {
      return ""
    }
  }

  // Returns the Spotify track URI that is currently shown on the player.
  // The track doesn't necessarily have to be playing.
  playerStatus(): Os2SpotifyPlayerStatus | undefined {
    return this.#playerStatus
  }

  // Returns the broadcast for Spotify player status changes.
  playerStatusBroadcast(): BroadcastController<Os2SpotifyPlayerStatus> {
    return this.#playerStatusBroadcast
  }

  async #handleLogInInitiate(
    scope: Scope,
    logInInitiate: Os2ClientMessageSpotifyLoginInitiate
  ): Promise<void> {
    if (this.#loginState !== undefined) {
      throw new Error("Already logging in")
    }
    const { cancel, attachment } = buildAttachmentForCancellation(true)
    this.#loginState = {
      cancel,
    }
    await Scope.with(scope, [attachment], async (scope) => {
      const storage = await this.#spotifyClient.interactiveLogin(
        scope,
        async (noVncUrl, debugNoVncUrl) => {
          this.#pushServerMessage({
            logInReady: {
              noVncUrl,
              debugNoVncUrl,
            },
          })
        },
        logInInitiate.debugEnabled
      )
      await this.#storagePusher(scope, storage)
      this.#pushServerMessage({
        logInComplete: {
          storage,
        },
      })
      this.#loginState = undefined
    })
  }

  async #handleLogInCancel(scope: Scope, logInCancel: {}): Promise<void> {
    if (this.#loginState === undefined) {
      throw new Error("Not logging in")
    }
    this.#loginState.cancel(new Error("Log in cancelled"))
    this.#loginState = undefined
  }

  async #handlePlayerConnect(
    scope: Scope,
    playerConnect: Os2ClientMessageSpotifyPlayerConnect
  ): Promise<void> {
    if (this.#playerState !== undefined) {
      throw new Error("Player is already in connect state")
    }
    const { cancel, attachment } = buildAttachmentForCancellation(true)
    this.#playerState = {
      cancel,
      playerController: undefined,
    }
    await Scope.with(scope, [attachment], async (scope) => {
      let playerReady = false
      let initialPausedStatus = true
      let playerStatusBeforeReady: Os2SpotifyPlayerStatus | undefined
      const storage = playerConnect.storage ?? await this.#storageFetcher(scope)
      console.log("[playerConnect storage]: ", storage)
      await this.#spotifyClient.withPlayerSession(
        scope,
        storage,
        (playerStatus) => {
          if (!playerReady) {
            if (!initialPausedStatus || playerStatus.playing) {
              initialPausedStatus = false
              playerStatusBeforeReady = playerStatus
            }
          } else {
            if (!initialPausedStatus || playerStatus.playing) {
              initialPausedStatus = false
              this.#playerStatus = playerStatus
              this.#playerStatusBroadcast.emit(playerStatus)
              this.#pushServerMessage({ playerStatus })
            }
          }
        },
        async (
          scope,
          serviceUrl,
          debugNoVncUrl,
          iceServersJson,
          playerController
        ) => {
          let scopeLeft = false
          scope.onLeave(async () => {
            scopeLeft = true
          })
          if (this.#playerState === undefined) {
            throw new Error("Player state is undefined")
          }
          this.#playerState = {
            ...this.#playerState,
            playerController: (playerControl) => {
              if (scopeLeft) {
                log.info("Player control ignored because scope left")
                return
              }
              return playerController(playerControl)
            },
          }
          this.#pushServerMessage({
            playerReady: {
              serviceUrl,
              debugNoVncUrl,
              iceServersJson,
            },
          })
          playerReady = true
          if (playerStatusBeforeReady !== undefined) {
            this.#playerStatus = playerStatusBeforeReady
            this.#playerStatusBroadcast.emit(playerStatusBeforeReady)
            this.#pushServerMessage({ playerStatus: playerStatusBeforeReady })
          }
          await sleepUntilCancel(scope)
        },
        playerConnect.debugEnabled
      )
    })
  }

  async #handlePlayerDisconnect(
    scope: Scope,
    playerDisconnect: {}
  ): Promise<void> {
    if (this.#playerState === undefined) {
      throw new Error("Player is not in connect state")
    }
    this.#playerState.cancel(new Error("Player disconnected"))
    this.#playerState = undefined
  }

  async #handlePlayerControl(
    scope: Scope,
    playerControl: Os2SpotifyPlayerControl
  ): Promise<void> {
    if (this.#playerState === undefined) {
      throw new Error("Player is not in connect state")
    }
    if (this.#playerState.playerController === undefined) {
      throw new Error("Player controller is not ready")
    }
    this.#playerState.playerController(playerControl)
  }

  async handleClientMessage(
    scope: Scope,
    spotifyMessage: Os2ClientMessageSpotify
  ): Promise<void> {
    console.log(JSON.stringify(spotifyMessage))
    if (spotifyMessage.logInInitiate !== undefined) {
      await this.#handleLogInInitiate(scope, spotifyMessage.logInInitiate)
    }
    if (spotifyMessage.logInCancel !== undefined) {
      await this.#handleLogInCancel(scope, spotifyMessage.logInCancel)
    }
    if (spotifyMessage.playerConnect !== undefined) {
      await this.#handlePlayerConnect(scope, spotifyMessage.playerConnect)
    }
    if (spotifyMessage.playerDisconnect !== undefined) {
      await this.#handlePlayerDisconnect(scope, spotifyMessage.playerDisconnect)
    }
    if (spotifyMessage.playerControl !== undefined) {
      await this.#handlePlayerControl(scope, spotifyMessage.playerControl)
    }
    if (spotifyMessage.logInStatus !== undefined) {
      await this.#handleLogInStatus(scope, spotifyMessage.logInStatus)
    }
  }
}
