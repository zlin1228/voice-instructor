from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from uuid import uuid4

mongo_password = "eLVGtLSn2qmKZAgp"
uri = f"mongodb+srv://info:{mongo_password}@rabbit-os.fu6px.mongodb.net/?retryWrites=true&w=majority"

# Create a new client and connect to the server
client = MongoClient(uri, server_api=ServerApi("1"))
# Send a ping to confirm a successful connection
try:
    client.admin.command("ping")
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(e)

vendors = [
    "CloudFactory",
    "M47",
    "Quest",
    "Toloka"
]

presetBunnyBuildStateIds = [
    "V4SPUEGKPJSX",
    "4EOL8UPXWUUY",
]

vendor_task_records = {
    "CloudFactory": [],
    "M47": [],
    "Quest": [],
    "Toloka": [],
}

for vendor in vendors:
    for presetBunnyBuildStateId in presetBunnyBuildStateIds:
        taskId = str(uuid4())
        taskRecord = {
            "_id": taskId,
            "presetBunnyBuildStateId": presetBunnyBuildStateId,
            "organizationName": vendor,
        }
        # insert into preset-rabbit-dev.presetBunnyBuildTask
        db = client["preset-rabbit-dev"]
        collection = db["presetBunnyBuildTask"]
        collection.insert_one(taskRecord)

        # add to dict
        vendor_task_records[vendor].append(taskId)

for vendor in vendors:
    print(f"Done with {vendor} task records")
    print(vendor_task_records[vendor])
    # save to txt file
    with open(f"{vendor}_task_ids.txt", "w") as f:
        for taskRecord in vendor_task_records[vendor]:
            f.write(f"{taskRecord}\n")

