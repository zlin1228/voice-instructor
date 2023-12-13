import modal
from modal import Stub, web_endpoint
from typing import Dict

stub = Stub("kernel_serp")

image = modal.Image.debian_slim().run_commands(
    "apt-get update",
    "pip install google-search-results",
)


@stub.function(image=image, cpu=1)
@web_endpoint(method="POST")
def serp_agent(v: Dict):
    query = v["query"]
    search_config = v["search_config"]

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
            r"http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+",
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


    def json_to_readable(json_data, indent=0):
        readable = ""
        if isinstance(json_data, dict):
            for key, value in json_data.items():
                if value:
                    readable += "  " * indent + key + ":"
                    readable += json_to_readable(value, indent)
        elif isinstance(json_data, list):
            idx = 1
            for index, item in enumerate(json_data):
                if item:
                    ret = json_to_readable(item, indent + 1)
                    if len(ret) > 0:
                        readable += "  " * indent + str(idx) + ".\n"
                        readable += ret
                        idx += 1
        elif len(str(json_data)) > 0:
            readable += "  " * indent + str(json_data) + "\n"
        return readable

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

    stripped_results = strip_values(results)
    sanitized_results = sanitize_second_level(sanitize(stripped_results))
    return json.dumps(sanitized_results, indent=1).strip()