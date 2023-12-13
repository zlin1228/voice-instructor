from bs4 import BeautifulSoup, Tag
import os
import time
import re
from typing import Optional
import json

PARSER = "lxml"

html_tags = [
    "!--",
    "!DOCTYPE",
    "a",
    "abbr",
    "acronym",
    "address",
    "applet",
    "area",
    "article",
    "aside",
    "audio",
    "b",
    "base",
    "basefont",
    "bdi",
    "bdo",
    "big",
    "blockquote",
    "body",
    "br",
    "button",
    "canvas",
    "caption",
    "center",
    "cite",
    "code",
    "col",
    "colgroup",
    "data",
    "datalist",
    "dd",
    "del",
    "details",
    "dfn",
    "dialog",
    "dir",
    "div",
    "dl",
    "dt",
    "em",
    "embed",
    "fieldset",
    "figcaption",
    "figure",
    "font",
    "footer",
    "form",
    "frame",
    "frameset",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "head",
    "header",
    "hr",
    "html",
    "i",
    "iframe",
    "img",
    "input",
    "ins",
    "kbd",
    "label",
    "legend",
    "li",
    "link",
    "main",
    "map",
    "mark",
    "meta",
    "meter",
    "nav",
    "noframes",
    "noscript",
    "object",
    "ol",
    "optgroup",
    "option",
    "output",
    "p",
    "param",
    "picture",
    "pre",
    "progress",
    "q",
    "rp",
    "rt",
    "ruby",
    "s",
    "samp",
    "script",
    "section",
    "select",
    "small",
    "source",
    "span",
    "strike",
    "strong",
    "style",
    "sub",
    "summary",
    "sup",
    "svg",
    "table",
    "tbody",
    "td",
    "template",
    "textarea",
    "tfoot",
    "th",
    "thead",
    "time",
    "title",
    "tr",
    "track",
    "tt",
    "u",
    "ul",
    "var",
    "video",
    "wbr",
]

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
    # search for any tag that is not a
    for tag in parent_div.find_all():
        if tag.text == "" and tag.contents == [] and tag.name != "a":
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