
queries = ["what's 12345+54321"]
import urllib.request
import os
import time

for i, query in enumerate(queries):
    a = time.time()
    query = query.replace(" ", "+")
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler(
            {'http': 'http://brd-customer-hl_eac73315-zone-serp:knns112d9hpq@brd.superproxy.io:22225',
            'https': 'http://brd-customer-hl_eac73315-zone-serp:knns112d9hpq@brd.superproxy.io:22225'}))
    result = (opener.open(f'http://www.google.com/search?q={query}').read())
    # save to file
    # make directory first
    if not os.path.exists('batch_query_bright'):
        os.makedirs('batch_query_bright', exist_ok=True)

    with open(f'batch_query_bright/{i}.html', 'wb') as f:
        f.write(result)
    
    print(f'query {i} took {time.time() - a} seconds')