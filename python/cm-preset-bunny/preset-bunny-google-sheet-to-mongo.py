import modal

stub = modal.Stub(
    "preset_bunny_google-sheet_mongo",
    image=modal.Image.debian_slim().pip_install(
        "pygsheets", "pymongo", "pandas", "numpy", "tqdm"
    ),
)


@stub.function(secret=modal.Secret.from_name("gsheets"))
def read_sheet(document_id):
    import pygsheets
    import os
    from tqdm import tqdm
    import pandas as pd
    from pymongo.mongo_client import MongoClient
    from pymongo.server_api import ServerApi
    from uuid import uuid4

    mongo_password = os.environ["MONGO_PASSWORD"]
    uri = f"mongodb+srv://info:{mongo_password}@rabbit-os.fu6px.mongodb.net/?retryWrites=true&w=majority"
    # Create a new client and connect to the server
    client = MongoClient(uri, server_api=ServerApi("1"))
    # Send a ping to confirm a successful connection
    try:
        client.admin.command("ping")
        print("Pinged your deployment. You successfully connected to MongoDB!")
    except Exception as e:
        print(e)

    gc = pygsheets.authorize(service_account_env_var="SERVICE_ACCOUNT_JSON")
    sh = gc.open_by_key(document_id)
    wks = sh.sheet1
    results = wks.get_all_values(
        include_tailing_empty=False, include_tailing_empty_rows=False
    )

    # results[0] is all the column names
    # results[1:] is all the data
    # Create a dataframe from the results
    df = pd.DataFrame.from_records(results[1:], columns=results[0])

    # get preset rabbit database
    db = client["pbb-test"]

    # add a document like this
    """
    {"_id":"UIX3VJ0YA1WU","appId":"3LSIH6EHEN8F","definition":{"name":"Add a dish to cart for delivery on Doordash","description":"Add ${item} from ${restaurant} to shopping cart for delivery on Doordash. Configure it with ${configuration}, and ship it to ${delivery_addresss}, report the price.","cleanupDescription":"Cancel the order.","parameters":[{"name":"delivery_addresss","type":"address"},{"name":"restaurant","type":"string"},{"name":"item","type":"string"},{"name":"configuration","type":"string"}],"reportNames":["price"]}}
    """

    import json

    for i, ro in df.iterrows():
        print(ro)

        try:
            # Step 1: Configure appProfile
            print("Step 1: Configure appProfile")
            """
            appProfile_name                                                                    Spotify
            appProfile_type                                                                        web
            appProfile_category                                                                  music
            appProfile_description                                             Play music from Spotify
            appProfile_url                                                   https://open.spotify.com/
            appProfile_accountRequired                                                            TRUE
            appProfile_paymentRequired                                                           FALSE
            appProfile_streamAudio                                                                TRUE
            appProfile_streamVideo                                                               FALSE
            """
            appProfile = db["appProfile"]
            appName = ro["appProfile_name"]
            # if app exist, use the appId. if not, create a new app Id
            appNameExists = appProfile.find_one({"name": appName})

            if appNameExists:
                appId = appNameExists["_id"]
                print("App exists, use the existing appId", appName, appId)
            else:
                appId = str(uuid4())

                appProfileRecord = {
                    "_id": appId,
                    "name": appName,
                    "type": ro["appProfile_type"],
                    "category": ro["appProfile_category"],
                    "description": ro["appProfile_description"],
                    "url": ro["appProfile_url"],
                    "accountRequired": ro["appProfile_accountRequired"] == "TRUE",
                    "paymentRequired": ro["appProfile_paymentRequired"] == "TRUE",
                    "streamAudio": ro["appProfile_streamAudio"] == "TRUE",
                    "streamVideo": ro["appProfile_streamVideo"] == "TRUE",
                }

                print("App does not exist, create a new appId", appName, appId)
                # insert
                appProfile.insert_one(appProfileRecord)

            # Step 2: Configure appAccount
            print("Step 2: Configure appAccount")
            """
            appAccount_name                                                             Password login
            appAccount_email                                                 TonyRamirez1337@gmail.com
            appAccount_password                                                   kymBuq-mifsaf-2wumpy
            appAccount_phone                                                              #18184743824
            """
            appAccount = db["appAccount"]

            appAccountExists = appAccount.find_one(
                {"appId": appId, "account.name": ro["appAccount_name"]}
            )

            appAccountRecord = {
                "appId": appId,
                "account": {
                    "name": f"{appName} - {ro['appAccount_name']} - {ro['appAccount_email']}",
                    "attributes": [
                        {"name": "email", "value": ro["appAccount_email"]},
                        {"name": "password", "value": ro["appAccount_password"]},
                        {"name": "phone", "value": ro["appAccount_phone"]},
                    ],
                },
            }

            if appAccountExists:
                appAccountId = appAccountExists["_id"]

                # upsert
                appAccount.update_one(
                    {"_id": appAccountId, "appId": appId, "account.name": appAccountRecord["account"]["name"]},
                    {"$set": appAccountRecord},
                    upsert=True,
                )

            else:
                appAccountId = str(uuid4())
                appAccountRecord["_id"] = appAccountId

                # insert
                appAccount.insert_one(appAccountRecord)

            # Step 3: Configure presetBunny
            print("Step 3: Configure presetBunny")
            """
            presetBunnyDoc_name                                  Search for information about an album
            presetBunnyDoc_description               Search for information about an album with the...
            presetBunnyDoc_cleanupDescription                                                     None
            presetBunnyDoc_parameters                   [{\n   name: "query",\n   type: "string",\n},]
            presetBunnyDoc_reportNames                                  ["release_date", "track_list"]
            presetBunnyBuildStateDoc_openHoursUtc                                                 0,24
            """
            presetBunny = db["presetBunny"]

            presetBunnyExists = presetBunny.find_one({"definition.name": ro["presetBunnyDoc_name"]})


            presetBunnyRecord = {
                "appId": appId,
                "definition": {
                    "name": ro["presetBunnyDoc_name"],
                    "description": ro["presetBunnyDoc_description"],
                    "cleanupDescription": ro["presetBunnyDoc_cleanupDescription"],
                    "parameters": json.loads(ro["presetBunnyDoc_parameters"]),
                    "reportNames": json.loads(ro["presetBunnyDoc_reportNames"]),
                },
            }

            if presetBunnyExists:
                presetBunnyId = presetBunnyExists["_id"]

                # upsert
                presetBunny.update_one(
                    {"_id": presetBunnyId, "appId": appId},
                    {"$set": presetBunnyRecord},
                    upsert=True,
                )
            else:
                presetBunnyId = str(uuid4())
                presetBunnyRecord["_id"] = presetBunnyId

                # insert
                presetBunny.insert_one(presetBunnyRecord)

            
            # Step 4: Configure presetBunnyBuildState
            print("Step 4: Configure presetBunnyBuildState")
            """
            presetBunnyBuildStateDoc_openHoursUtc                                                 0,24
            presetBunnyBuildStateDoc_arg1            [{\nname: "query",\nvalue: "Pocket Symphony AN...
            presetBunnyBuildStateDoc_arg2            [{\nname: "query",\nvalue: "Tsuki no Utsutsu A...
            presetBunnyBuildStateDoc_arg3            [{\nname: "query",\nvalue: "Discovery AND Daft...
            presetBunnyBuildStateDoc_arg4            [{\nname: "query",\nvalue: "Thriller AND Micha...
            presetBunnyBuildStateDoc_arg5            [{\r\nname: 'query',\r\nvalue: '21 AND Adele',...
            presetBunnyBuildStateDoc_arg6            [{\r\nname: 'query',\r\nvalue: 'The Dark Side ...
            presetBunnyBuildStateDoc_arg7            [{\r\nname: 'query',\r\nvalue: 'Nevermind AND ...
            presetBunnyBuildStateDoc_arg8            [{\r\nname: 'query',\r\nvalue: 'The Joshua Tre...
            presetBunnyBuildStateDoc_arg9            [{\r\nname: 'query',\r\nvalue: 'Rumours AND Fl...
            presetBunnyBuildStateDoc_arg10           [{\r\nname: 'query',\r\nvalue: 'Abbey Road AND...
            """
            presetBunnyBuildState = db["presetBunnyBuildState"]

            presetBunnyBuildStateExists = presetBunnyBuildState.find_one(
                {"presetBunnyId": presetBunnyId}
            )

            openhours = ro["presetBunnyBuildStateDoc_openHoursUtc"].split(",")
            openhours = {
                "openHour": int(openhours[0]),
                "closeHour": int(openhours[1]),
            }

            samples = []

            # go over arg1 to arg10. if parsed, add to samples
            for i in range(1, 11):
                arg = ro[f"presetBunnyBuildStateDoc_arg{i}"]
                if arg:
                    samples.append({
                        "argumentList": json.loads(arg),
                    })

            print(len(samples), "samples", samples)

            presetBunnyBuildStateRecord = {
                "appId": appId,
                "appAccountId": appAccountId,
                "presetBunnyId": presetBunnyId,
                "openHoursUtc": openhours,
                "recordTasks": [],
                "reviewTasks": [],
                "samples": samples
            }

            if presetBunnyBuildStateExists:
                presetBunnyBuildStateId = presetBunnyBuildStateExists["_id"]

                # upsert
                presetBunnyBuildState.update_one(
                    {"presetBunnyId": presetBunnyId},
                    {"$set": presetBunnyBuildStateRecord},
                    upsert=True,
                )
            else:
                presetBunnyBuildStateId = str(uuid4())
                presetBunnyBuildStateRecord["_id"] = presetBunnyBuildStateId

                # insert
                presetBunnyBuildState.insert_one(presetBunnyBuildStateRecord)


            # Step 5: Configure presetBunnyBuildTask
            print("Step 5: Configure presetBunnyBuildTask")
            presetBunnyBuildTask = db["presetBunnyBuildTask"]

            presetBunnyBuildTaskExists = presetBunnyBuildTask.find_one(
                {"presetBunnyBuildStateId": presetBunnyBuildStateId}
            )

            presetBunnyBuildTaskRecord = {
                "presetBunnyBuildStateId": presetBunnyBuildStateId,
                "organizationName": ro["presetBunnyBuildTask_organizationName"],
                "record": {},
            }

            if presetBunnyBuildTaskExists:
                presetBunnyBuildTaskId = presetBunnyBuildTaskExists["_id"]

                # upsert
                presetBunnyBuildTask.update_one(
                    {"_id": presetBunnyBuildTaskId},
                    {"$set": presetBunnyBuildTaskRecord},
                    upsert=True,
                )
            else:
                presetBunnyBuildTaskId = str(uuid4())
                presetBunnyBuildTaskRecord["_id"] = presetBunnyBuildTaskId

                # insert
                presetBunnyBuildTask.insert_one(presetBunnyBuildTaskRecord)

            print("Success!")
        except Exception as e:
            print("Error:", e)



@stub.local_entrypoint()
def main(doc_id: str = "1IStSy7aPeGWv47VKYcDPWfzxdkvk-wuqcBvtWw0tK4k"):
    # Run this script like: `modal run gsheets.py --doc-id ...`
    # You can extract your document's id from the url, e.g.:
    # https://docs.google.com/spreadsheets/d/1IStSy7aPeGWv47VKYcDPWfzxdkvk-wuqcBvtWw0tK4k
    # has the doc id 1IStSy7aPeGWv47VKYcDPWfzxdkvk-wuqcBvtWw0tK4k
    read_sheet.remote(doc_id)
