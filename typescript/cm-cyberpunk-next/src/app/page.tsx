import Link from "next/link"
import Image from "next/image"
import { getSession, withApiAuthRequired } from "@auth0/nextjs-auth0"
// import { useUser } from "@auth0/nextjs-auth0/client"
import { ApiKeyDoc } from "@/model"
import { getGlobalService } from "@/service"
import { runRequestScope } from "base-node/lib/request-scope"
import { log } from "base-core/lib/logging"
import { CopyButton } from "./CopyButton"

import cyberpunkBrandingImg from "../../src/images/Cyberpunk-branding.png"

async function getUserEmail(): Promise<string | undefined> {
  const session = await getSession()
  if (!session) {
    return undefined
  }
  // Disable email verification for now
  // if (session.user["email_verified"] !== true) {
  //   return undefined
  // }
  const email = session.user["email"] as unknown
  if (typeof email !== "string") {
    return undefined
  }
  return email
}

async function ApiKeysPanel(props: { userEmail: string }) {
  const apiKey = await runRequestScope(async (scope) => {
    const service = await getGlobalService()
    return await service.getApiKeyForUser(scope, props.userEmail)
  })
  async function refreshApiKey(formData: FormData) {
    "use server"
    await runRequestScope(async (scope) => {
      const service = await getGlobalService()
      const userEmail = await getUserEmail()
      if (userEmail === undefined) {
        throw new Error("User email is undefined")
      }
      const apiKeyDoc = await service.refreshApiKey(scope, userEmail)
      log.info(`Refreshed API key for user [${userEmail}]: ${apiKeyDoc._id}`)
      console.log(apiKeyDoc)
    })
  }
  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <div style={{ width: "500px",
                    marginTop: "50px" }}>
        <form
          style={{
            display: "flex",
            justifyContent: "space-around",
            width: "500px",
            marginTop: "25px",
          }}
        >
          <input
            name="apiKey"
            value={apiKey._id}
            readOnly
            style={{
              backgroundColor: "#c3c3c3",
              marginLeft: "10px",
              marginRight: "20px",
              padding: "5px 5px 5px 20px",
              flexGrow: "1",
            }}
          />{" "}
          <CopyButton content={apiKey._id} />
        </form>
        <form
          action={refreshApiKey}
          style={{
            marginLeft: "10px",
            display: "flex",
            width: "500px",
          }}
        >
          <button
            type="submit"
            style={{
              padding: "5px 20px 5px 20px",
              color: "#00c1e0",
              background: "linear-gradient(45deg, transparent 5px, #040a0b 0)",
            }}
          >
            RE-GENERATE KEY
          </button>
        </form>
      </div>
      <div style={{ margin: "100px" }}>
      <iframe src="https://player.vimeo.com/video/855572181?h=5f2a6b9909" style={{
        position: "relative",
        width: "1000px",
        height: "563px",
        margin: "0 auto",
      }} allow="autoplay; fullscreen; picture-in-picture"></iframe>
        <p
          style={{
            margin: "45px",
            textAlign: "center",
            fontSize: "20px",
            fontWeight: "normal",
          }}
        >
          INSTALLATION & RUNNING INSTRUCTIONS
        </p>
        <div style={{ width: "1000px", textAlign: "left", fontSize: "15px" }}>
          <ul style={{ margin: "25px" }}>
            - INSTALL CYBERPUNK 2077 FROM STEAM AND{" "}
            <a
              href="https://store.steampowered.com/app/2060310/Cyberpunk_2077_REDmod"
              style={{ fontWeight: "900" }}
            >
              REDMOD
            </a>
            , THE OFFICIAL MOD MANAGER.
          </ul>
          <ul style={{ margin: "25px" }}>
            - DOWNLOAD THE MOD ZIP FROM  
            <a
              href="https://storage.googleapis.com/quantum-engine-public/quantum-engine-cyberpunk/quantum_engine_0815.zip"
              style={{ textDecoration: "underline" }}
            >
              THIS LINK
            </a>
            . THE FILE NAME SHOULD BE IN THE FORMAT OF `quantum_engine_
            {"{VERSION}"}.zip`, WHERE {"{VERSION}"} REPRESENTS THE RELEASE DATE.
            WHEN A NEW VERSION IS RELEASED, THE PREVIOUS VERSION WILL BE
            DEPRECATED.
          </ul>
          <ul style={{ margin: "25px" }}>
            - UNZIP THE ZIP FILE AND COPY ALL CONTENTS INSIDE THE FOLDER (E.G.
            `R6`) TO THE GAME{"'"}S ROOT DIRECTORY, E.G, `C:\Program
            Files(x86)\Steam\steamapps\common\Cyberpunk 2077`. NOTE THAT THIS IS JUST A SAMPLE PATH IF YOUR STEAM IS INSTALLED IN THE DEFAULT LOCATION. YOUR ACTUAL PATH MAY BE DIFFERENT.
          </ul>
          <ul style={{ margin: "25px" }}>
            - OBTAIN A KEY FROM ABOVE AND COPY IT TO THE FILE (ASSUMING YOU ARE
            USING STEAM)  C:\Program Files
            (x86)\Steam\steamapps\common\Cyberpunk 2077\bin\x64\key.txt (SIMILAR TO THE NOTICE ABOVE, THIS IS JUST A SAMPLE PATH. YOUR ACTUAL PATH MAY BE DIFFERENT.)
            REPLACE [ENTER YOUR KEY HERE], A SINGLE LINE, NO SPACE, NO NEWLINE,
            NO QUOTES.
          </ul>
          <ul style={{ margin: "25px" }}>
            - OPTIONALLY, DOWNLOAD THE SAMPLE SAVE FILE FROM  
            <a
              href="https://storage.googleapis.com/quantum-engine-public/quantum-engine-cyberpunk/PointOfNoReturnSave-0.zip"
              style={{ textDecoration: "underline" }}
            >
              THIS LINK
            </a>
            , AND COPY IT TO THE GAME{"'"}S SAVE DIRECTORY, E.G., `C:\Users\
            {"{username}"}\Saved Games\CD Projekt Red\Cyberpunk 2077`.
          </ul>
          <ul style={{ margin: "25px" }}>
            - LAUNCH THE GAME IN STEAM, CLICK `ENABLE MODS` IN THE REDMOD
            LAUNCHER AND LOAD THE SAVE FILE.
          </ul>
          <ul style={{ margin: "25px" }}>
            - WHEN APPROACHING ANY NPC IN THE NIGHT CITY, A RED MODAL WILL POP
            UP SAYING `QUANTUM ENGINE STARTED. YOU ARE TALKING TO {"{NPC NAME}"}
            .` THIS INDICATES THAT THE MOD IS WORKING PROPERLY.
          </ul>
          <ul style={{ margin: "25px" }}>
            - IF YOU WOULD LIKE TO DISABLE THE MOD, SIMPLY DELETE `key.txt`. IF
            YOUR KEY HAS EXPIRED OR IS INVALID, YOU WILL SEE A RED MODAL SAYING
            `QUANTUM ENGINE NOT LOGGED IN.`
          </ul>
          <ul style={{ margin: "25px" }}>
            - TO UNINSTALL THE MOD, YOU HAVE TO REMOVE BOTH THE REDSCRIPT
            SCRIPTS AND THE RED4EXT PLUGINS. WE HAVE PROVIDED A BATCH SCRIPT TO
            DO THIS FOR YOU IF YOU ARE USING STEAM. SEE `uninstall.bat` IN THE
            ZIP FILE FOR REFERENCE.
          </ul>
          <ul style={{ margin: "25px" }}>
            - THE MOD IS COMPILED FOR WINDOWS 11 64-BIT. IT IS LIKELY NOT
            COMPATIBLE WITH OTHER OPERATING SYSTEMS. THE MOD IS DEPENDENT ON AND
            INSPIRED BY A NUMBER OF OTHER MOD FRAMEWORKS, INCLUDING REDSCRIPT,
            RED4EXT, AND CYBER ENGINE TWEAKS. WE THANK THE MODDING COMMUNITY FOR
            THEIR CONTRIBUTIONS, ESPECIALLY JACK HUMBERT{"'"}S LEGENDARY  
            <a
              href="https://github.com/jackhumbert/let_there_be_flight"
              style={{ textDecoration: "underline" }}
            >
              LET THERE BE FLIGHT
            </a>
            .
          </ul>
          <ul style={{ margin: "25px" }}>
            - WANT TO HELP US IMPROVE THE MOD? OUR REDSCRIPT IS OPEN SOURCE AND
            AVAILABLE ON GITHUB AT  
            <a
              href="https://github.com/cyber-manufacture-co/cyberpunk-public"
              style={{ textDecoration: "underline" }}
            >
              THIS LINK
            </a>
            . FEEL FREE TO CHECK IT OUT AND CONTRIBUTE! OUR UNDERLYING LANGUAGE
            MODEL COULD USE SOME IMPROVEMENTS TO BE MORE IMMERSIVE. PLEASE SEND
            OTHER FEEDBACK TO PEIYUAN AT CYBERMANUFACTURE DOT CO.
          </ul>
        </div>
        <p
          style={{
            margin: "45px",
            textAlign: "center",
            fontSize: "20px",
            fontWeight: "normal",
          }}
        >
          KNOWN ISSUES
        </p>
        <div style={{ width: "1000px", textAlign: "left", fontSize: "15px" }}>
          <ul style={{ margin: "25px" }}>
            - WHEN YOU ARE RUNNING THE MOD FOR THE FIRST TIME, YOU MAY SEE THE CET OVERLAY. BIND THE KEY TO AN ARBITRARY 
            KEY AND PRESS IT TO CLOSE THE OVERLAY. YOU WILL NOT SEE THE OVERLAY AGAIN.
          </ul>
          <ul style={{ margin: "25px" }}>
            - FOR THE BEST EXPERIENCE, PLEASE USE A HEADSET MICROPHONE. THE MOD 
            WILL STILL FUNCTION WITH A SPEAKER AND BUILT-IN MICROPHONE, BUT THE 
            NPCs MAY HAVE TROUBLE HEARING YOU OR HEARING THEMSELVES.
          </ul>
        </div>
      </div>
    </div>
  )
}

export default async function Home() {
  const userEmail = await getUserEmail()
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-evenly",
        padding: "10px",
        marginTop: "240px",
      }}
    >
      <Image
        src={cyberpunkBrandingImg}
        width={500}
        height={500}
        alt="Cyberpunk"
      />
      {userEmail ? (
        <ApiKeysPanel userEmail={userEmail} />
      ) : (
        <>
          <a href="/api/auth/login">
            <button
              className="text-cyan-500 bg-gray-950 hover:text-gray-950 hover:bg-cyan-500"
              style={{
                clipPath: "polygon(90% 0, 100% 28%, 100% 100%, 0 100%, 0 0)",
                padding: "5px",
                marginTop: "30px",
                width: "100px",
              }}
            >
              LOGIN
            </button>
          </a>
          <div style={{ margin: "40px" }}>
            <div
              style={{ width: "1000px", textAlign: "left", fontSize: "15px" }}
            >
              <ul style={{ margin: "25px" }}>
                <li>
                  LATEST RELEASED VERSION:{" "}
                  <span
                    style={{
                      color: "red",
                    }}
                  >
                    0815
                  </span>
                  . DOWNLOAD IT  
                  <a
                    href="https://storage.googleapis.com/quantum-engine-public/quantum-engine-cyberpunk/quantum_engine_0815.zip"
                    style={{ textDecoration: "underline" }}
                  >
                    HERE
                  </a>
                  .
                </li>
              </ul>

              <ul style={{ margin: "25px" }}>
                <li>
                  SERVER STATUS: <span style={{ color: "green" }}>ONLINE</span>
                </li>
              </ul>

              <ul style={{ margin: "25px" }}>
                <li>
                  QUANTUM ENGINE IS A TECHNOLOGY THAT MAKES INTERACTING WITH AI
                  MORE INTUITIVE, FRIENDLY, AND POWERFUL.
                </li>
              </ul>

              <ul style={{ margin: "25px" }}>
                <li>
                  TO DEMONSTRATE THE POWER OF OUR TECHNOLOGY AND GLIMPSE THE
                  FUTURE OF IMMERSIVE ENTERTAINMENT, WE HAVE CREATED A MOD FOR
                  CYBERPUNK 2077 THAT ALLOWS YOU TO TALK TO ANY NPC IN THE GAME
                  WITH YOUR VOICE.
                </li>
              </ul>

              <ul style={{ margin: "25px" }}>
                <li>
                  OUR {'"'}SECRET SAUCE{'"'} HAVE ENABLED AI NPCS TO HAVE
                  HUMAN-LEVEL RESPONSE TIMES ON ANY PLATFORM, INCLUDING AAA
                  GAMES, AS DEMONSTRATED HERE.
                </li>
              </ul>

              <ul style={{ margin: "25px" }}>
                <li>
                  INTERESTED IN SEEING QUANTUM ENGINE DEPLOYED ON MORE GAMES?
                  PLEASE VISIT OUR WEBSITE AT CYBERMANUFACTURE.CO OR EMAIL US AT
                  INFO@CYBERMANUFACTURE.CO.
                </li>
              </ul>
            </div>
            <br />
            <br />
            <iframe src="https://player.vimeo.com/video/855572181?h=5f2a6b9909" style={{
              position: "relative",
              width: "1000px",
              height: "563px",
              margin: "80 auto",
            }} allow="autoplay; fullscreen; picture-in-picture"></iframe>
          </div>
        </>
      )}
    </div>
  )
}
