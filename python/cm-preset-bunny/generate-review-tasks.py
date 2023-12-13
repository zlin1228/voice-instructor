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

# pbb-test.presetBunnyTaskMetrics
db = client["pbb-test"]
collection = db["presetBunnyTaskMetrics"]
tasks = db["presetBunnyBuildTask"]

# grab all succeeded=true
cursor = collection.find({"succeeded": True})

n_review = 0

for document in cursor:
    # print(document) 

    # get presetBunnyBuildStateId from presetBunnyBuildTask
    task_id = document["taskId"]
    task_document = tasks.find_one({"_id": task_id})
    organization_name = task_document["organizationName"]   
    # print(task_document)
    # if the task document is a review task, skip
    if "review" in task_document:
        continue
    
    presetBunnyBuildStateId = task_document["presetBunnyBuildStateId"]

    # generate a review task, put in pbb-test.presetBunnyBuildTask
    """
    {"_id":"ff8b2f42-4099-45d5-a26c-679910dc19f9","presetBunnyBuildStateId":"de7de000-9c63-40ce-8a54-fa88327aa131","organizationName":"Toloka","record":{}}
    """

    new_task = {
        "_id": str(uuid4()),
        "presetBunnyBuildStateId": presetBunnyBuildStateId,
        "organizationName": organization_name,
        "review": {}
    }

    print(new_task)

    tasks.insert_one(new_task)

    n_review += 1

print(f"Total review tasks: {n_review}")