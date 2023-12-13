from common import *

def html_table_to_text(table):
    text = ''
    for row in table.find_all('tr'):
        for cell in row.find_all(['td', 'th']):
            text += cell.get_text().strip() + ', ' if cell.get_text().strip() != "" else ""
        text += " || "
    return text.strip()

def flatten_pipeline(parent_div):
    # if a div has only span, em, h1, h2, h3, h4, or nothing, then flatten it
    # need to also excluded nested divs or other tags
    for div in parent_div.find_all("div"):
        if all(
            [
                child.name in ["span", "em", "h1", "h2", "h3", "h4", "p"]
                or isinstance(child, Tag) == False
                for child in div.children
            ]
        ):
            text = " ".join(div.stripped_strings)
            # print(text)
            # replace children with a new span with the text
            div.clear()
            if text != "":
                # print("\t", text)
                # print("\t")
                div.append(BeautifulSoup(f"{text}", PARSER))
        # else:
        # print([child.name for child in div.children], div)

    for a in parent_div.find_all("a"):
        if all(
            [
                child.name in ["span", "em", "h1", "h2", "h3", "h4", "p"]
                or isinstance(child, Tag) == False
                for child in a.children
            ]
        ):
            text = " ".join(a.stripped_strings)
            # print(text)
            # replace children with a new span with the text
            a.clear()
            if text != "":
                a.append(BeautifulSoup(f"{text}", PARSER))

    for span in parent_div.find_all("span"):
        # if it's a tag or a free text
        if all(
            [
                child.name in ["span", "em", "h1", "h2", "h3", "h4"]
                or isinstance(child, Tag) == False
                for child in span.children
            ]
        ):
            text = " ".join(span.stripped_strings)
            # print(text)
            # replace children with a new span with the text
            span.clear()
            if text != "":
                span.append(BeautifulSoup(f"{text}", PARSER))


def clean_empty_tags(parent_div):
    # search for any tag
    for tag in parent_div.find_all():
        if tag.text == "" and tag.contents == []:
            tag.decompose()


def unwrap_pipeline(parent_div):
    condition_met = False
    counter = 0
    while not condition_met:
        condition_met = True
        for div in parent_div.find_all("div"):
            if len(div.contents) == 1:
                # print(div.contents[0])
                div.unwrap()
                condition_met = False
            elif len(div.contents) == 0:
                div.decompose()
                condition_met = False
            else:
                pass
        counter += 1

    # print("Counter: ", counter)

def search_id_parser(content, json_=False):
    soup = BeautifulSoup(content, PARSER)

    # Find the first div with id = "search"
    search_div = soup.find("div", {"id": "search"})

    if search_div is not None:
        # get the first children div
        parent_div = search_div.find("div")

        # replace br with space
        for br in parent_div.find_all("br"):
            br.replace_with(" ")

        # replace all tables with text
        for table in parent_div.find_all("table"):
            table.replace_with(html_table_to_text(table))

        # remove all h1 that contains "Page Navigation"
        for h1 in parent_div.find_all("h1"):
            if "Page Navigation" in h1.text.strip():
                h1.parent.decompose()

        # remove all h1 divs with text "Main Results"
        for h1 in parent_div.find_all("h1"):
            if (
                h1.text.strip() == "Main Results"
                or "Page Navigation" in h1.text.strip()
            ):
                h1.decompose()

        # remove all elements with aria-hidden="true"
        for tag in parent_div.find_all():
            if tag.attrs is not None and (
                (tag.has_attr("aria-hidden") and tag["aria-hidden"] == "true")
                or tag.has_attr("aria-live")
            ):
                tag.decompose()
        # remove all div with role="button"
        for tag in parent_div.find_all("div"):
            if (
                tag.attrs is not None
                and tag.has_attr("role")
                and tag["role"] == "button"
            ):
                tag.decompose()

        # remove span with text People also ask
        for span in parent_div.find_all("span"):
            if "People also ask" in span.text.strip():
                span.decompose()
        # remove text People also ask and Disclaimer
        re1 = "People also ask"
        re2 = "Disclaimer"
        re3 = "About"
        re4 = "More news"
        re5 = "Explore more"
        re6 = "Related"
        re7 = "Following"
        for text in parent_div.find_all(
            text=re.compile(
                "(%s|%s|%s|%s|%s|%s|%s)" % (re1, re2, re3, re4, re5, re6, re7)
            )
        ):
            text.parent.replace_with("")
        # remove parent div of div with text "Choose what you’re giving feedback on"
        for div in parent_div.find_all("div"):
            if div.text.strip() == "Choose what you’re giving feedback on":
                div.parent.decompose()

        # add , to the end of each span
        for span in parent_div.find_all("span"):
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
        for div in parent_div.find_all("div"):
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
        for h in parent_div.find_all(["h1", "h2", "h3", "h4"]):
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
        for script in parent_div.find_all("script"):
            script.decompose()
        for style in parent_div.find_all("style"):
            style.decompose()
        for svg in parent_div.find_all("svg"):
            svg.decompose()
        for button in parent_div.find_all("button"):
            button.decompose()

        # remove g-img, g-loading-icon, label
        for g_img in parent_div.find_all("g-img"):
            g_img.decompose()
        for g_loading_icon in parent_div.find_all("g-loading-icon"):
            g_loading_icon.decompose()
        for g_snackbar in parent_div.find_all("g-snackbar"):
            g_snackbar.decompose()
        for label in parent_div.find_all("label"):
            label.decompose()

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
        for tag in parent_div.find_all():
            for attr in attributes_to_remove:
                if tag.has_attr(attr):
                    del tag[attr]

        # if aria-label="Give feedback on this result", remove the a
        for a in parent_div.find_all("a"):
            if a.has_attr("aria-label") and (
                a["aria-label"] == "Give feedback on this result"
            ):
                a.decompose()

        for div in parent_div.find_all("div"):
            if div.has_attr("aria-label") and div["aria-label"] == "About this result":
                div.decompose()

        clean_empty_tags(parent_div)

        # replace this
        """
        <cite role="text">
        https://greenwichmeantime.com
        <span role="text">
        › time › stockholm
        </span>
        </cite>
        """
        # with text https://greenwichmeantime.com › time › stockholm
        for cite in parent_div.find_all("cite"):
            text = " ".join(cite.stripped_strings)
            # print(text)
            # replace the cite with a new span with the text
            # get parent
            # replace cite with text
            cite.replace_with(BeautifulSoup(f"{text}", PARSER))

        # get rid of image tags with src with data:image
        for img in parent_div.find_all("img"):
            if img.has_attr("src") and img["src"].startswith("data:image"):
                img.decompose()

        unwrap_pipeline(parent_div)
        flatten_pipeline(parent_div)
        clean_empty_tags(parent_div)

        # remove every a that contains text See more and Disclaimer
        for a in parent_div.find_all("a"):
            for s in ["See more", "Disclaimer"]:
                if s in a.text.strip():
                    a.decompose()

        # for every a, check to see if the next div has the same text in the first div in the a. If so, remove the div
        for a in parent_div.find_all("a"):
            if a.has_attr("href"):
                # get the text in the first div in the a
                div = a.find("div")
                if div is not None:
                    div_text = div.text.strip()
                    # print("div_text: ", div_text)
                    # get the next div
                    next_div = a.find_next_sibling("div")
                    if next_div is not None:
                        # if the text in the next div is the same as the text in the h3, remove the next div
                        # print("next_div.text.strip(): ", next_div.text.strip())
                        if next_div.text.strip() == div_text:
                            next_div.decompose()

        # assert that parent div has only two children
        if len(parent_div.contents) != 2:
            print("Warning: Parent div has more than two children.")

        # make all div with role="heading" into an h2
        for div in parent_div.find_all("div"):
            if div.has_attr("role") and div["role"] == "heading":
                div.name = "h2"
                # add : to h2
                if div.text.strip() != "":
                    div.string = div.text.strip() + ": "
                # remove all attributes from the div
                for attr in list(div.attrs):
                    del div[attr]

        for p in parent_div.find_all("p"):
            p.replace_with(p.text)

        # for all block-component tag, parse the children into a raw string of div, ignore tags
        for block_component in parent_div.find_all("block-component"):
            # if the first element is a h2 and is Featured snippet from the web:
            if (
                block_component.find("h2") is not None
                and "Featured snippet from the web"
                in block_component.find("h2").text.strip()
            ):
                # get the raw string
                raw_string = block_component.prettify()
                # print(raw_string)
                # match all tags that are not html tags, defined by html_tags
                tags = html_tags.copy() + ["block-component"]
                pattern = r"<(?!/?({0})\b)[^>]*>".format("|".join(tags))
                pattern = re.compile(pattern)

                # replace all tags that are not html tags with the tag name, but remove the closing tag
                def sub_fn(x):
                    if x.group().startswith("</"):
                        # print(x.group())
                        return ""
                    else:
                        # print(x.group())
                        return x.group().replace("<", "").replace(">", "")

                text = pattern.sub(sub_fn, raw_string)
                # get the stripped string
                text = " ".join(BeautifulSoup(text, PARSER).stripped_strings)
                text = text.replace('=""', "")
                text = text.split("\n")
                text = [t.strip() for t in text if t.strip() != ""]
                text = " ".join(text)
                # replace artifacts from /[a word]
                restructured_html = f"""<h2>Featured snippet from the web:</h2><div>{text.replace('Featured snippet from the web:', '')}</div>"""
                # replace the block-component with a new div with the text
                block_component.replace_with(BeautifulSoup(restructured_html, PARSER))

        # make all irregular tags into divs
        for tag in parent_div.find_all():
            if tag.name not in html_tags:
                tag.name = "div"
                # remove all attributes from the div
                for attr in list(tag.attrs):
                    del tag[attr]

        # if "Search Results" h1 doesn't exist, then add it
        if (
            parent_div.find("h1") is None
            or "Search Results" not in parent_div.find("h1").text.strip()
        ):
            h1 = BeautifulSoup(f"""<h1>Search Results</h1>""", PARSER).find("h1")
            parent_div.insert(0, h1)

        # remove all a tags that are not links that start with http or https
        for a in parent_div.find_all("a"):
            if a.has_attr("href") and not a["href"].startswith(("http", "https")):
                a.decompose()

        if parent_div is not None:
            # remove all attributes from the parent div
            for attr in list(parent_div.attrs):
                del parent_div[attr]

            # Create a new soup with just the parent div
            new_soup = BeautifulSoup(str(parent_div), PARSER)

            # inject a margin of 10px to every div
            for div in new_soup.find_all("div"):
                div["style"] = "margin-top: 10px;"

            if json_:
                # prepare JSON
                # get the next div after the h1
                next_div = parent_div.find("h1").find_next_sibling("div")
                # if the next div is not None
                # print("next_div: ", parent_div)
                if next_div is not None:
                    # all children divs in the next div are main results
                    main_results = list(next_div.children)
                    # if there are only two children, expand the second child and get all children divs
                    if len(main_results) == 2:
                        main_results = [main_results[0]] + list(main_results[1].children)
                    # for each main result, summarize it
                    results = []
                    print("\tmain_results: ", len(main_results))
                    for main_result in main_results:
                        if isinstance(main_result, Tag):
                            result = []

                            # for each a, get the href and the stripped_string of it's children, for everything else, use stripped_strings
                            for a in main_result.find_all("a"):
                                if a.has_attr("href"):
                                    href = a["href"]
                                    text = " ".join(a.stripped_strings)
                                    result.append({"href": href, "text": text})
                                else:
                                    text = " ".join(a.stripped_strings)
                                    result.append({"href": None, "text": text})

                            # for all immediate children tags that are not a, get the stripped_strings
                            for tag in main_result.find_all():
                                if tag.name == "a":
                                    tag.decompose()
                            text = " ".join(main_result.stripped_strings)
                            result.append({"href": None, "text": text})
                        else:
                            result = [{"href": None, "text": main_result.strip()}]
                        results.append(result)
                        #print(result)
                    print("\tresults: ", len(results))

                    json_string = json.dumps(results, indent=4)
                    # render the json string
                    return json_string
                else:
                    print("No next div found for the h1 tag.")
            else:
                return str(new_soup.prettify())

        else:
            print("No parent div found for the h1 tag.")
    else:
        print("No search result")
