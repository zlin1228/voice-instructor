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

vendor_task_records_review = {
    "CloudFactory": [],
    "M47": [],
    "Quest": [],
    "Toloka": [],
}

vendor_task_records_record = {
    "CloudFactory": [],
    "M47": [],
    "Quest": [],
    "Toloka": [],
}

for vendor in vendors:
    db = client["pbb-test"]
    collection = db["presetBunnyBuildTask"]
    
    # get all _id with organizationName = vendor
    cursor = collection.find({"organizationName": vendor})
    all_task_ids_review = []
    all_task_ids_record = []
    for document in cursor:
        if "review" in document:
            all_task_ids_review.append(document["_id"])
        else:
            all_task_ids_record.append(document["_id"])

    # add to dict
    vendor_task_records_record[vendor].extend(all_task_ids_record)
    vendor_task_records_review[vendor].extend(all_task_ids_review)

for vendor in vendors:
    print(f"Done with {vendor} task records")
    print("--------------------------------- Review")
    print(vendor_task_records_review[vendor])
    print("--------------------------------- Record")
    print(vendor_task_records_record[vendor])
    # save to txt file
    with open(f"{vendor}_task_ids_record.txt", "w") as f:
        for task_id in vendor_task_records_record[vendor]:
            f.write(f"{task_id}\n")

    with open(f"{vendor}_task_ids_review.txt", "w") as f:
        for task_id in vendor_task_records_review[vendor]:
            f.write(f"{task_id}\n")

