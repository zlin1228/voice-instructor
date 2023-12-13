# heavy.py
import modal

stub = modal.Stub("lightspeed-community-1-shutdown")

image = modal.Image.debian_slim().pip_install(
    "boto3", "beautifulsoup4", "lxml", "fastapi", "starlette", "pymongo", "google-search-results", "openai"
)


@stub.function(image=image, schedule=modal.Period(hours=3))
def shutdown_stage_1():
    import pymongo
    from pymongo import MongoClient
    client = MongoClient('mongodb+srv://yunsong:bJ7iUmUeD2iEBJXJ@society-production.ederh.mongodb.net/?retryWrites=true&w=majority')
    # get worlds from freytag database, worlds collection
    db = client['freytag']
    worlds = db['worlds']
    # get all worlds with {world_started: true}
    worlds_started = list(worlds.find({'world_started': True}))
    print('worlds_started: ', len(list(worlds_started)))
    # set all worlds with {world_started: true} to {world_started: false}
    for world in worlds_started:
        worlds.update_one({'_id': world['_id']}, {'$set': {'world_started': False}})

    print('Set {} worlds to world_started: false'.format(len(list(worlds_started))))

    # assert that all worlds have {world_started: false}
    worlds_started = worlds.find({'world_started': True})
    print('worlds_started: ', worlds_started)
    assert(len(list(worlds_started)) == 0)

    return 'shutdown_stage_1 done'