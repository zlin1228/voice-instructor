from common import *

def calculator_parser(content, json_=False):
    soup = BeautifulSoup(content, PARSER)

    # Find the first h1 with text Content Navigation Bar
    content_nav_div = soup.find("h2", text="Calculator Result")

    if content_nav_div is not None:
        # get the next div
        content_nav_div = content_nav_div.find_next_sibling("div")

        final_content = ""
        for x in content_nav_div.stripped_strings:
            if x.strip() != "":
                final_content += x.strip() + " "

        # content nav div is a single div of final content
        content_nav_div = BeautifulSoup(
            f"""<div>{final_content}</div>""", PARSER
        ).find("div")

        if content_nav_div is not None:

            # Create a new soup with just the parent div
            new_soup = BeautifulSoup(str(content_nav_div), PARSER)

            # inject a margin of 10px to every div
            for div in new_soup.find_all("div"):
                div["style"] = "margin-top: 10px;"

            if json_:
                results = [[{
                    "href": None,
                    "text": final_content
                }]]

                json_string = json.dumps(results, indent=4)
                return json_string
            else:
                return str(new_soup.prettify())

        else:
            print("No parent div found for the h2 tag.")
    else:
        print("No search result")
