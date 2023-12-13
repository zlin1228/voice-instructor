import time
import copy
from typing import Any

from bs4 import BeautifulSoup

import html_utils
from bunny_controller import BunnyController
from replay_context import ReplayContext


class ActionExecutor:
    """Base class for action executors."""
    def __init__(
        self,
        controller: BunnyController,
        page_id: str,
    ) -> None:
        self.controller = controller
        self.page_id = page_id

    def __call__(
        self,
        context: ReplayContext,
        retry: int = 3
    ):
        """Perform a step."""
        target_soup, tree_id = self.fetch_dom(self.page_id)

        target_subtree = html_utils.follow_selectors(copy.deepcopy(target_soup), context.reference.selectors)

        if context.sub_instruction['type'] == 'calendar':
            # heuristic to get the calendar
            target_subtree = html_utils.get_subtree_having_semantic_meaning(target_subtree, minimum_go_up=2)
        else:
            target_subtree = html_utils.get_subtree_having_semantic_meaning(target_subtree, minimum_go_up=0)

        snippet = html_utils.simplify_html(
            target_subtree,
            do_contract_edge=True,
            node_id_attr='node_id',
            keep_tag_name=context.reference.target_node.name
        )

        for _ in range(retry):
            return self.execute(context, snippet, tree_id, retry=retry)

    def fetch_dom(self, page_id):
        """Fetch dom."""
        for _ in range(10):
            dom = self.controller.fetch_web_dom(page_id)
            if dom is None:
                time.sleep(0.5)
                continue

            tree_id = dom["singlePageAction"]["pageAction"]["treeAction"]["fetch"]["tree"]["treeId"]
            root_node_id = dom["singlePageAction"]["pageAction"]["treeAction"]["fetch"]["tree"][
                "rootNodeId"
            ]
            nodes = dom["singlePageAction"]["pageAction"]["treeAction"]["fetch"]["tree"][
                "nodes"
            ]
            html = dom_nodes_to_html(nodes, root_node_id)
            soup = BeautifulSoup(html, "lxml").body
            return soup, tree_id

    def execute(
            self,
            context: ReplayContext,
            snippet: str,
            tree_id: str,
            retry: int = 3
    ) -> int:
        """Execute an action on the given node."""
        raise NotImplementedError()


def dom_nodes_to_html(nodes, root_node_id):
    """Convert DOM nodes to HTML."""
    nodes_dict = {v["nodeId"]: v for v in nodes}

    def _node_to_html(node):
        if node["attributes"][0]["value"] == "html-element":
            tag = node["attributes"][1]["value"]
            node_id_str = f'node_id="{node["nodeId"]}"'
            attrs = node["attributes"][2:]
            attrs_str = " ".join(
                [
                    f'{attr["name"][len("html-attr/"):]}="{attr["value"]}"'
                    for attr in attrs
                    if attr["name"].startswith("html-attr")
                ]
            )
            open_tag = f"<{tag} {node_id_str} {attrs_str}>"
            child_tag = "".join(
                [_node_to_html(nodes_dict[child_id]) for child_id in node["childIds"]]
            )
            close_tag = f"</{tag}>"
            return open_tag + child_tag + close_tag
        else:
            return [_ for _ in node["attributes"] if _['name'] == 'core-text'][0]["value"]

    root_element = nodes_dict[root_node_id]
    return _node_to_html(root_element)