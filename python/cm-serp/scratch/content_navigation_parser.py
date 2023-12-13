from common import *

def content_navigation_parser(content, json_=False):
    soup = BeautifulSoup(content, PARSER)

    # Find the first h1 with text Content Navigation Bar
    content_nav_div = soup.find("h1", text="Content Navigation Bar")

    if content_nav_div is not None:
        # get the next div
        content_nav_div = content_nav_div.find_next_sibling("div")

        # replace br with space
        for br in content_nav_div.find_all("br"):
            br.replace_with(" ")

        # replace all tables with text
        for table in content_nav_div.find_all("table"):
            table.replace_with(html_table_to_text(table))

        for g_img in content_nav_div.find_all("g-img"):
            g_img.decompose()
        for g_loading_icon in content_nav_div.find_all("g-loading-icon"):
            g_loading_icon.decompose()
        for g_snackbar in content_nav_div.find_all("g-snackbar"):
            g_snackbar.decompose()

        # remove span with text People also ask
        for span in content_nav_div.find_all("span"):
            if "People also ask" in span.text.strip():
                span.decompose()
        # remove text People also ask and Disclaimer
        re1 = "People also ask"
        re2 = "Disclaimer"
        re3 = "About"
        re4 = "More news"
        re5 = "Explore more"
        re6 = "Related"
        re7 = "Feedback"
        for text in content_nav_div.find_all(
            text=re.compile(
                "(%s|%s|%s|%s|%s|%s|%s)" % (re1, re2, re3, re4, re5, re6, re7)
            )
        ):
            text.parent.replace_with("")
        # remove parent div of div with text "Choose what you’re giving feedback on"
        for div in content_nav_div.find_all("div"):
            if div.text.strip() == "Choose what you’re giving feedback on":
                div.parent.decompose()

        # add , to the end of each span
        for span in content_nav_div.find_all("span"):
            # if this is the innermost span
            if len(span.find_all("span")) == 0:
                if span.text.strip() != "":
                    # if it doesn't already end with a comma, or another punctuation
                    if span.text.strip()[-1] not in [
                        ",",
                        ".",
                        "!",
                        "?",
                        ";",
                        ":",
                        "$",
                        "%",
                        "]",
                        "}",
                        ">",
                        "»",
                        "›",
                    ]:
                        span.string = span.text.strip() + ", "

        # add , to the end of each div
        for div in content_nav_div.find_all("div"):
            # if this is the innermost div with just text
            if len(div.find_all("div")) == 0 and len(div.find_all("span")) == 0:
                if div.text.strip() != "":
                    # if it doesn't already end with a comma, or another punctuation
                    if div.text.strip()[-1] not in [
                        ",",
                        ".",
                        "!",
                        "?",
                        ";",
                        ":",
                        "$",
                        "%",
                        "]",
                        "}",
                        ">",
                        "»",
                        "›",
                    ]:
                        div.string = div.text.strip() + ", "

        # add : to h1, h2, h3, h4
        for h in content_nav_div.find_all(["h1", "h2", "h3", "h4"]):
            if h.text.strip() != "":
                # if it doesn't already end with a comma, or another punctuation
                if h.text.strip()[-1] not in [
                    ",",
                    ".",
                    "!",
                    "?",
                    ";",
                    ":",
                    "$",
                    "%",
                    "]",
                    "}",
                    ">",
                    "»",
                    "›",
                ]:
                    h.string = h.text.strip() + ": "

        # get rid of script tags and style, and svg, and button
        for script in content_nav_div.find_all("script"):
            script.decompose()
        for style in content_nav_div.find_all("style"):
            style.decompose()
        for svg in content_nav_div.find_all("svg"):
            svg.decompose()
        for button in content_nav_div.find_all("button"):
            button.decompose()

        clean_empty_tags(content_nav_div)

        attributes_to_remove = [
            "data-lk",
            "data-ved",
            "aria-controls",
            "data-async-fc",
            "data-async-context",
            "data-usg",
            "jsaction",
            "style",
            "class",
            "id",
            "data-bs",
            "data-jsarwt",
            "eid",
            "data-snc",
            "data-hveid",
            "jscontroller",
            "jsname",
            "jsdata",
            "data-id",
            "data-dep",
            "data-esos",
            "data-sosm",
            "data-tfts",
            "data-eprs",
        ]
        for tag in content_nav_div.find_all():
            for attr in attributes_to_remove:
                if tag.has_attr(attr):
                    del tag[attr]

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
            print("No parent div found for the h1 tag.")
    else:
        print("No search result")
