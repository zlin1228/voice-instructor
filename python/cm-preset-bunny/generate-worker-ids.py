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

# Get all worker ids from pbb-test DB, presetBunnyWorker collection, collect all _id
db = client["pbb-test"]
collection = db["presetBunnyWorker"]
cursor = collection.find({})
all_worker_ids = []
for document in cursor:
    all_worker_ids.append(document["_id"])

vendors = [
    "CloudFactory",
    "M47",
    "Quest",
    "Toloka"
]

print(all_worker_ids)

# 2000 ids per vendor
start_idx = 0
for vendor in vendors:
    vendor_ids = all_worker_ids[start_idx:start_idx+2000]
    start_idx += 2000

    # store in a txt file
    with open(f"{vendor}_worker_ids.txt", "w") as f:
        for worker_id in vendor_ids:
            f.write(f"{worker_id}\n")

    print(f"Done with {vendor} ids")

