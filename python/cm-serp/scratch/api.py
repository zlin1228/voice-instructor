from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi

from datetime import datetime
from typing import Dict
import json
from functools import reduce
from urllib.parse import quote_plus
from search_id_parser import search_id_parser
from content_navigation_parser import content_navigation_parser

uri = "mongodb+srv://info:NdmL686hU2AcK2Sv@serp.isc9bqm.mongodb.net/?retryWrites=true&w=majority"
# Create a new client and connect to the server
client = MongoClient(uri, server_api=ServerApi('1'))

about = """Text are explanations of href, where href is not None.
When the href is None, the text can be outdated. Therefore, if the query is about the time or weather, do not use the text.
The first result is most likely to be the most relevant and accurate result.
""".strip()

import openai 
openai.api_key = "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"

def _search(v: Dict, mode="dev"):
    query = v["query"]
    llm = v["llm"]
    
    _raw_query = query
    query = quote_plus(query)
    if not query:
        return None
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
        processed = parser(res, json_=True)
        if processed:
            results.append(processed)
            parser_names.append(parser.__name__)

    # combine two json by first parsing them, then dumping them
    # into a single json
    results = [json.loads(result) for result in results]
    # results = reduce add results
    _results = []
    for result in results:
        _results += result
    results = _results
    
    db = client['serp']
    collection = db['scratch']

    collection.insert_one({
        'query': _raw_query,
        'json': results,
        'type': 'api_' + mode,
        'timestamp': datetime.now(),
        'sanitized_results': results,
        'raw_html': str(res),
    })

    ret = {
        "results": results,
        "about": about,
    }

    if llm:
        formattedTime = datetime.now().strftime("%I:%M %p")
        messages = [
            {"role": 'user', "content": f"""
Question: {query}
Observation: {json.dumps(results, indent=4)}
1. If there are inconsistencies between the observation and the preliminary response, clearly indicate that the preliminary resposne is incorrect, and apologize.
2. If your preliminary response is correct, you can simply say something along the line of "I did my research and confirmed my preliminary response is correct." Do not repeat information.
3. It is {formattedTime}. Remember that.
4. Start your response with "I searched and found that" or a variation of it, in English.
5. The relevant context may contain outdated or inaccurate information. If ther observation exists in the relevant context but not in the preliminary response, you may still say it.
6. If the result is long, summarize it. For numbers, round to the nearest integer.
7. For stock prices, convert the price from dollar sign and decimal points to dollars and cents format. Say the name of the company, not the symbol. E.g. AMZN -> Amazon, 1,234.56 -> 1234 dollars and 56 cents.
8. For weather, say the temperature in Fahrenheit and Celsius, and round everything to the nearest integer. 
9. Don't mention that you've searched with Google or any other search engine. Don't bring up latitude or longitude.
10. Important! Answer solely in English. Do not use any other language.
Important Rule: {about}
Answer (solely in English):""".strip()}]
        completion = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=messages
        )

        llm_response = completion.choices[0].message["content"]

        ret["llm_response"] = llm_response

    return ret
