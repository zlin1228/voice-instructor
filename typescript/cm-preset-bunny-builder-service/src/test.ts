import { Scope, runParallelScopes } from "base-core/lib/scope.js"
import { runMainScope } from "base-node/lib/main-scope.js"
import { buildModelClient } from "./profile.js"
import { buildRandomStringId } from "base-mongodb/lib/mongodb.js"
import { AppProfile } from "cm-bunny-host-common/lib/bunny/bunny.js"
import {
  AppAccountDoc,
  AppProfileDoc,
  ModelClient,
  PresetBunnyDoc,
  PresetBunnyBuildStateDoc,
  PresetBunnyBuildTaskDoc,
} from "./model.js"
import { log } from "base-core/lib/logging.js"
import { arrayRepeat } from "base-core/lib/array.js"

async function addDoordash(scope: Scope, modelClient: ModelClient) {
  const appProfile: AppProfileDoc = {
    _id: buildRandomStringId(),
    name: "Doordash",
    type: "web",
    category: "food",
    description: "Order a dish from a restaurant",
    url: "https://www.doordash.com/",
    accountRequired: true,
    paymentRequired: true,
    streamAudio: false,
    streamVideo: false,
  }
  const appAccount: AppAccountDoc = {
    _id: buildRandomStringId(),
    appId: appProfile._id,
    account: {
      name: "Password login from TonyRamirez1337@gmail.com",
      attributes: [
        {
          name: "email",
          value: "TonyRamirez1337@gmail.com",
        },
        {
          name: "password",
          value: "papdyn-xiggax-9Rudwy",
        },
      ],
    },
  }
  const presetBunnyDoc: PresetBunnyDoc = {
    _id: buildRandomStringId(),
    appId: appProfile._id,
    definition: {
      name: "Add a dish to cart for delivery on Doordash",
      description:
        "Add ${item} from ${restaurant} to shopping cart for delivery on Doordash. Configure it with ${configuration}, and ship it to ${delivery_addresss}, report the price.",
      cleanupDescription: "Cancel the order.",
      parameters: [
        {
          name: "delivery_addresss",
          type: "address",
        },
        {
          name: "restaurant",
          type: "string",
        },
        {
          name: "item",
          type: "string",
        },
        {
          name: "configuration",
          type: "string",
        },
      ],
      reportNames: ["price"],
    },
  }
  const presetBunnyBuildStateDoc: PresetBunnyBuildStateDoc = {
    _id: buildRandomStringId(),
    appId: appProfile._id,
    appAccountId: appAccount._id,
    presetBunnyId: presetBunnyDoc._id,
    openHoursUtc: {
      openHour: 16,
      closeHour: 24,
    },
    samples: [
      {
        argumentList: [
          {
            name: "delivery_addresss",
            value: "1078 Summit Ave, Jersey City, NJ 07307",
          },
          {
            name: "restaurant",
            value: "Burger King",
          },
          {
            name: "item",
            value: "Double Cheeseburger",
          },
          {
            name: "configuration",
            value: "Add Onion",
          },
        ],
      },
    ],
    recordTasks: [],
    reviewTasks: [],
  }
  const presetBunnyBuildTaskRecordDoc: PresetBunnyBuildTaskDoc = {
    _id: buildRandomStringId(),
    presetBunnyBuildStateId: presetBunnyBuildStateDoc._id,
    organizationName: "rabbit",
    record: {},
  }
  const presetBunnyBuildTaskReviewDoc: PresetBunnyBuildTaskDoc = {
    _id: buildRandomStringId(),
    presetBunnyBuildStateId: presetBunnyBuildStateDoc._id,
    organizationName: "rabbit",
    review: {},
  }
  await modelClient.appProfileCollection.createOrReplace(scope, appProfile)
  await modelClient.appAccountCollection.createOrReplace(scope, appAccount)
  await modelClient.presetBunnyCollection.createOrReplace(scope, presetBunnyDoc)
  await modelClient.presetBunnyBuildStateCollection.createOrReplace(
    scope,
    presetBunnyBuildStateDoc
  )
  await modelClient.presetBunnyBuildTaskCollection.createOrReplace(
    scope,
    presetBunnyBuildTaskRecordDoc
  )
  await modelClient.presetBunnyBuildTaskCollection.createOrReplace(
    scope,
    presetBunnyBuildTaskReviewDoc
  )
}

async function addSpotify(scope: Scope, modelClient: ModelClient) {
  const appProfile: AppProfileDoc = {
    _id: buildRandomStringId(),
    name: "Spotify",
    type: "web",
    category: "music",
    description: "Access music from Spotify",
    url: "https://open.spotify.com/",
    accountRequired: true,
    paymentRequired: false,
    streamAudio: true,
    streamVideo: false,
  }
  const appAccount: AppAccountDoc = {
    _id: buildRandomStringId(),
    appId: appProfile._id,
    account: {
      name: "Password login",
      attributes: [
        {
          name: "email",
          value: "(will provide in real task)",
        },
        {
          name: "password",
          value: "(will provide in real task)",
        },
      ],
    },
  }
  const presetBunnyDoc: PresetBunnyDoc = {
    _id: buildRandomStringId(),
    appId: appProfile._id,
    definition: {
      name: "Search the artist of a song",
      description:
        "Search the artist of a song given the song name ${song}, report the artist name.",
      cleanupDescription: "(none)",
      parameters: [
        {
          name: "song",
          type: "string",
        },
      ],
      reportNames: ["artist"],
    },
  }
  const presetBunnyBuildStateDoc: PresetBunnyBuildStateDoc = {
    _id: buildRandomStringId(),
    appId: appProfile._id,
    appAccountId: appAccount._id,
    presetBunnyId: presetBunnyDoc._id,
    samples: [
      {
        argumentList: [
          {
            name: "song",
            value: "Hotel California",
          },
        ],
      },
      {
        argumentList: [
          {
            name: "song",
            value: "Fly Me to the Moon",
          },
        ],
      },
    ],
    recordTasks: [],
    reviewTasks: [],
  }
  const presetBunnyBuildTaskRecordDoc: PresetBunnyBuildTaskDoc = {
    _id: buildRandomStringId(),
    presetBunnyBuildStateId: presetBunnyBuildStateDoc._id,
    organizationName: "rabbit",
    record: {},
  }
  const presetBunnyBuildTaskReviewDoc: PresetBunnyBuildTaskDoc = {
    _id: buildRandomStringId(),
    presetBunnyBuildStateId: presetBunnyBuildStateDoc._id,
    organizationName: "rabbit",
    review: {},
  }
  await modelClient.appProfileCollection.createOrReplace(scope, appProfile)
  await modelClient.appAccountCollection.createOrReplace(scope, appAccount)
  await modelClient.presetBunnyCollection.createOrReplace(scope, presetBunnyDoc)
  await modelClient.presetBunnyBuildStateCollection.createOrReplace(
    scope,
    presetBunnyBuildStateDoc
  )
  await modelClient.presetBunnyBuildTaskCollection.createOrReplace(
    scope,
    presetBunnyBuildTaskRecordDoc
  )
  await modelClient.presetBunnyBuildTaskCollection.createOrReplace(
    scope,
    presetBunnyBuildTaskReviewDoc
  )
}

async function addWorkers(
  scope: Scope,
  modelClient: ModelClient
): Promise<void> {
  const date = new Date()
  const count = 10000
  await modelClient.presetBunnyWorkerCollection.bulkCreateOrReplace(
    scope,
    arrayRepeat(0, count).map((_, idx) => {
      return {
        _id: buildRandomStringId(),
        createdAt: date,
        note: `Worker ${idx + 1}/${count} created by ${
          process.env["USER"] ?? "(unknown)"
        }`,
        logins: [],
      }
    })
  )
}

async function main(scope: Scope, cancel: (error: Error) => void) {
  const modelClient = await buildModelClient(scope)
  await addWorkers(scope, modelClient)
  await addDoordash(scope, modelClient)
  await addSpotify(scope, modelClient)
}

void (async () => {
  await runMainScope(main)
  // process.exit()
})()
