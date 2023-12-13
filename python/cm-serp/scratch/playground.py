from bs4 import BeautifulSoup, Tag
from datetime import datetime
from typing import Optional
import json
from functools import reduce

from search_id_parser import search_id_parser
from content_navigation_parser import content_navigation_parser
from common import PARSER
from modal import Image, Stub, asgi_app
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from urllib.parse import quote_plus

web_app = FastAPI()
stub = Stub("serp_playground")

image = Image.debian_slim().pip_install(
    "boto3", "beautifulsoup4", "lxml", "fastapi", "starlette", "pymongo"
)

from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
uri = "mongodb+srv://info:NdmL686hU2AcK2Sv@serp.isc9bqm.mongodb.net/?retryWrites=true&w=majority"
# Create a new client and connect to the server
client = MongoClient(uri, server_api=ServerApi('1'))

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from starlette.requests import Request
from starlette.responses import HTMLResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware

web_app = FastAPI()

head = lambda title: """
<head>
    <title>{title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="{title}">
    <meta name="keywords" content="{title}">
    <meta name="author" content="Cyber Manufacture Co.">
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="robots" content="index, follow">
    <link rel="icon" type="image/x-icon" href="https://storage.googleapis.com/quantum-engine-public/icons/cmc-ai.ico">
    <style>
        body {
            background-color: #f8f8f8;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 18px;
        }
        input {
            background-color: #f8f8f8;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 18px;
        }
        button {
            background-color: #f8f8f8;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 18px;
        }
        form {
            display : table;
            margin : 0 auto;
        }
    </style>
</head>
""".replace(
    "{title}", title
)

@web_app.get("/", response_class=HTMLResponse)
async def main():
    # add off-white css
    content = f"""
    {head("SERP Playground")}
    <body>
    <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh;">
        <div style="margin: 30px" >A simple, machine-friendly way to present search engine results.</div>
        <form action="/search" method="get">
            <input style="width: 300px; max-width: 60%; margin: 5px;" type="text" name="query" placeholder="Enter your query">
            <button style="margin: 5px;" type="submit" name="json" value="true">JSON</button>
            <button style="margin: 5px;" type="submit" name="json" value="false">HTML</button>
        </form>
    </div>
    </body>
    """
    return HTMLResponse(content=content)

@web_app.get("/search", response_class=HTMLResponse)
async def read_item(request: Request):
    query = request.query_params.get('query')
    json_ = request.query_params.get('json') == 'true'
    print("json", json_)
    _raw_query = query
    query = quote_plus(query)
    if not query:
        return RedirectResponse(url="/")
    url = f"https://www.google.com/search?q={query}"
    proxy = "http://brd.superproxy.io:22225"
    proxies = {"http://": proxy, "https://": proxy}
    print("query", query)
    import urllib.request

    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler(
            {
                "http": "http://brd-customer-hl_eac73315-zone-serp:knns112d9hpq@brd.superproxy.io:22225",
                "https": "http://brd-customer-hl_eac73315-zone-serp:knns112d9hpq@brd.superproxy.io:22225",
            }
        )
    )
    res = opener.open(f"http://www.google.com/search?q={query}").read()

    print("before", len(res))
    results = []
    parser_names = []
    for parser in [content_navigation_parser, search_id_parser]:
        processed = parser(res, json_=json_)
        if processed:
            results.append(processed)
            parser_names.append(parser.__name__)

    if (json_):
        # combine two json by first parsing them, then dumping them
        # into a single json
        results = [json.loads(result) for result in results]
        # results = reduce add results
        _results = []
        for result in results:
            _results += result
        results = _results
        results = json.dumps(results, indent=4)
        new_soup = BeautifulSoup(
            f"""<pre>{results}</pre>""", PARSER
        )

        # add header with head("query")
        header = head(f"Search Engine Results for '{_raw_query}'")
        header = BeautifulSoup(header, PARSER).find("head")

        # add header to new soup, before the body tag
        new_soup.insert(0, header)


        processed_html = str(new_soup.prettify())
        processed_json = json.loads(results)
    else:
        # combine two html by first parsing them, getting the body, then dumping them
        # into a single html
        results = [BeautifulSoup(result, PARSER).find("body") for result in results]
        
        # add h1 with the parser name
        #for i, result in enumerate(results):
        #    h1 = BeautifulSoup(f"""<h1>{parser_names[i]}</h1>""", PARSER)
        #    result.insert(0, h1)

        # new soup is a well formed html with the body of the two results
        new_soup = BeautifulSoup(
            f"""<body>{"".join([str(result) for result in results])}</body>""", PARSER
        )

        # add header with head("query")
        header = head(f"Search Engine Results for '{_raw_query}'")
        header = BeautifulSoup(header, PARSER).find("head")

        # add header to new soup, before the body tag
        new_soup.insert(0, header)

        processed_html = str(new_soup.prettify())
        processed_json = None

    # store query, request details, whether it's json, original html, and processed html in mongodb
    db = client['serp']
    collection = db['scratch']

    collection.insert_one({
        'query': query,
        'json': json_,
        'original_html': BeautifulSoup(res, PARSER).prettify(),
        'processed_html': processed_html,
        'processed_json': processed_json,
        'timestamp': datetime.now(),
        'origin': 'modal-webapp',
        'request': {
            'headers': request.headers,
            'client': request.client,
        }
    })

    return HTMLResponse(content=processed_html)


@stub.function(image=image)
@asgi_app()
def app():
    return web_app
