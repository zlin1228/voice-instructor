from typing import Dict
from datetime import datetime

from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
uri = "mongodb+srv://info:NdmL686hU2AcK2Sv@serp.isc9bqm.mongodb.net/?retryWrites=true&w=majority"
# Create a new client and connect to the server
client = MongoClient(uri, server_api=ServerApi('1'))

about = """knowledge_graph and answer_box has the highest likihood of containing correct, up-to-date information.
organic_results has a lower likihood of containing correct, up-to-date information. Especially when the query is time-sensitive, e.g. the weather or the time, organic_results is likely to contain outdated information.
 - within organic_results, snippet contains a short description of the search result, but may be omitted.
If the query is highly time-sensitive, e.g. the weather or the time, and the search results do not clearly indicate the results (e.g. answer box absent and organic_results are outdated). In this case, the organic_results may be omitted, and you may say "I searched and couldn't immediately find the answer. Do you want to perhaps search yourself?"
 - In this case, you could also suggest the user to use other tools, e.g. a watch to find the time, or look up to find the weather.
""".strip()

import openai 
openai.api_key = "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"

def _search(v: Dict, mode="dev"):
    query = v["query"]
    search_config = v["search_config"]
    llm = v["llm"]

    import re

    def strip_values(json_obj):
        if isinstance(json_obj, dict):
            new_obj = {}
            for key, value in json_obj.items():
                if not contains_link_number_date(value):
                    new_obj[key] = strip_values(value)
            return new_obj
        elif isinstance(json_obj, list):
            new_list = []
            for item in json_obj:
                if not contains_link_number_date(item):
                    new_list.append(strip_values(item))
            return new_list
        else:
            return json_obj


    def contains_link_number_date(value):
        if not isinstance(value, str):
            return False
        if re.search(
            r"http[s]?://(?:[a-zA-Z]|[0-9]|[-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+",
            value,
        ):
            return True
        if re.search(r"\d", value):
            return False
        if re.search(r"\d{4}-\d{2}-\d{2}", value):
            return False
        return False


    def sanitize(value):
        keys = [
            "search_metadata",
            "search_information",
            "search_parameters",
            "inline_people_also_search_for",
            "related_questions",
            "pagination",
            "serpapi_pagination",
            "organic_results",
            "inline_videos",
            "related_searches",
            "inline_images",
            "inline_images_suggested_searches",
            "ads",
            "questions_and_answers",
        ]
        actions = [
            "delete",
            "delete",
            "delete",
            "delete",
            "delete",
            "delete",
            "delete",
            "trim",
            "delete",
            "delete",
            "delete",
            "delete",
            "delete",
            "delete",
        ]

        for k, a in zip(keys, actions):
            if k in value:
                if a == "delete":
                    del value[k]
                elif a == "trim":
                    value[k] = value[k][:5]

        return value


    def sanitize_second_level(value):
        keys = ["organic_results"]
        actions = [
            (
                "delete",
                [
                    "rich_snippet_list",
                    "rich_snippet_table",
                    "about_this_result",
                    "position",
                ],
            )
        ]

        for k, a in zip(keys, actions):
            if k in value:
                if a[0] == "delete":
                    for k2 in a[1]:

                        def m(v):
                            if k2 in v:
                                del v[k2]
                            return v

                        value[k] = list(map(m, value[k]))

        return value

    from serpapi import GoogleSearch
    import json

    params = {
        "q": query,
        "location": search_config["location"],
        "hl": search_config["hl"],
        "google_domain": search_config["google_domain"],
        "api_key": "065a338e97c4a69a0072ed99b2cd821c789143fd45ff9bf9a1c8a4dab23cbd10",
    }

    search = GoogleSearch(params)
    results = search.get_dict()

    db = client['serp']
    collection = db['serpapi']

    print("results", results)

    stripped_results = strip_values(results)
    sanitized_results = sanitize_second_level(sanitize(stripped_results))

    collection.insert_one({
        'query': query,
        'json': results,
        'search_config': search_config,
        'type': 'serpapi_' + mode,
        'timestamp': datetime.now(),
        'sanitized_results': sanitized_results,
        'stripped_results': stripped_results,
    })

    ret = {
        "results": sanitized_results,
        "about": about,
    }


    if llm:
        formattedTime = datetime.now().strftime("%I:%M %p")
        messages = [
            {"role": 'user', "content": f"""
Question: {query}
Observation: {json.dumps(sanitized_results, indent=4)}
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