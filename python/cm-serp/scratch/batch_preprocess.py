from bs4 import BeautifulSoup, Tag
import os
import time
import re
import json
from search_id_parser import search_id_parser
from content_navigation_parser import content_navigation_parser

for _fname in os.listdir("batch_query_bright"):
    #if "3" in f:
    a = time.time()

    with open(f"batch_query_bright/{_fname}", "r") as f:
        html = f.read()
    
    for parser in [search_id_parser, content_navigation_parser]:
        parsed_html = parser(html, json_=False)
        parsed_json = parser(html, json_=True)

        if not os.path.exists("cleaned_batch_query_bright"):
            os.makedirs("cleaned_batch_query_bright", exist_ok=True)
        if not os.path.exists("json_batch_query_bright"):
            os.makedirs("json_batch_query_bright", exist_ok=True)

        fname = _fname.split(".")[0] + "_" + parser.__name__ + ".html"

        if parsed_html:
            with open(f"cleaned_batch_query_bright/{fname}", "w") as f:
                f.write(parsed_html)
        
        jfname = _fname.split(".")[0] + "_" + parser.__name__ + ".json"

        if parsed_json:
            with open(f"json_batch_query_bright/{jfname}", "w") as f:
                f.write(parsed_json)

        b = time.time()
        print(f"File {_fname} took {round(b-a, 4) * 1000} miliseconds to process.")
