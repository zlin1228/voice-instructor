import os
import json
import copy
from collections import namedtuple

from bs4 import BeautifulSoup
import html_utils

from logger_setup import get_logger

logger = get_logger()


StepItem = namedtuple(
    "StepItem",
    [
        "url",
        "soup",
        "soup_simplified",
        "target_node_id",
        "target_node",
        "selectors",
        "snippet",
        "event"
    ]
)


def load_json(path):
    """Load JSON file."""
    logger.debug("Loading JSON file from %s", path)
    with open(path, "r", encoding='utf-8') as f:
        return json.load(f)


def save_json(path, data):
    """Save JSON file."""
    logger.debug("Saving JSON file to %s", path)
    with open(path, "w", encoding='utf-8') as f:
        json.dump(data, f)


def _remove_redundant_steps(steps):
    """Remove redundant steps."""
    new_steps = []
    for step in steps:
        tree_step = step["treeStep"]
        click = tree_step.get("click")
        fill = tree_step.get("fill")

        if click is not None:
            if len(new_steps) == 0:
                new_steps.append(step)
                continue

            if step['eventNodeId'] != new_steps[-1]['eventNodeId']:
                new_steps.append(step)
                continue

        elif fill is not None:
            if fill["value"] == "":
                continue

            if len(new_steps) == 0:
                new_steps.append(step)
                continue

            last_step = new_steps[-1]
            if last_step["treeStep"].get("fill") is not None:
                new_steps = new_steps[:-1]
                new_steps.append(step)
            else:
                new_steps.append(step)

    return new_steps


def _get_event(step):
    tree_step = step["treeStep"]
    click = tree_step.get("click")
    fill = tree_step.get("fill")
    if click is not None:
        return ["click", None]
    if fill is not None:
        return ["fill", fill["value"]]
    raise NotImplementedError


def _preprocess(step):
    state = step["state"]

    soup = BeautifulSoup(state["html"], "lxml").body
    url = state["url"]
    target_node_id = step["eventNodeId"]
    nodes_to_target = html_utils.get_path_to_target(soup, target_node_id, node_id_attr='__bunny_node_id')
    selectors = html_utils.build_selectors(nodes_to_target)
    simplified_soup = html_utils.simplify_html(
        copy.deepcopy(soup), target_node_id, node_id_attr="__bunny_node_id"
    )
    target_node = html_utils.find_node_by_id(
        simplified_soup, target_node_id, node_id_attr="__bunny_node_id"
    )
    snippet = html_utils.get_subtree_having_semantic_meaning(target_node)
    event = _get_event(step)

    step_item = StepItem(
        url=url,
        soup=soup,
        soup_simplified=simplified_soup,
        target_node_id=target_node_id,
        target_node=target_node,
        selectors=selectors,
        snippet=snippet,
        event=event,
    )

    logger.debug("_preprocess")
    logger.debug("step_item.url: %s", step_item.url)
    logger.debug("step_item.target_node_id: %s", step_item.target_node_id)
    logger.debug("step_item.target_node: %s", step_item.target_node)
    logger.debug("step_item.snippet: %s", step_item.snippet)
    logger.debug("step_item.event: %s", step_item.event)

    return step_item


class Recording:
    """Represent a recording."""

    def __init__(self, recoding_path: str) -> None:
        logger.debug("Initialize recording")
        preprocessed_dict = self._load_preprocessed(self._get_preprocessed_path(recoding_path))
        if preprocessed_dict is not None:
            logger.debug("Found preprocessed recording. Skip preprocessing.")
            self.tree_steps = preprocessed_dict['tree_steps']
            self.preprocessed_steps = preprocessed_dict['preprocessed_steps']
        else:
            logger.debug("Preprocessing recording.")
            tree_steps = load_json(recoding_path)
            self.tree_steps = _remove_redundant_steps(tree_steps)
            self.preprocessed_steps = [_preprocess(step) for step in self.tree_steps]
            logger.debug("Saving preprocessed recording.")
            self._save_preprocessed(self._get_preprocessed_path(recoding_path))

        logger.debug("Finish initializing recording. %s steps in total.", len(self.preprocessed_steps))

    def _get_preprocessed_path(self, path):
        return path + '.preprocessed.json'

    def _save_preprocessed(self, path):
        preprocessed_steps = [{k:v if isinstance(v, (list, dict, str)) else str(v) for k, v in _._asdict().items()}
                              for _ in self.preprocessed_steps]

        preprocessed_dict = {
            'tree_steps': self.tree_steps,
            'preprocessed_steps': preprocessed_steps
        }
        save_json(path, preprocessed_dict)
        
    def _load_preprocessed(self, path):
        if not os.path.exists(path):
            return None

        preprocessed_dict = load_json(path)

        def _dict_to_step_item(d):
            return StepItem(
                url=d['url'],
                soup=BeautifulSoup(d['soup'], "lxml").body,
                soup_simplified=BeautifulSoup(d['soup_simplified'], "lxml").body,
                target_node_id=d['target_node_id'],
                target_node=next(iter(BeautifulSoup(d['target_node'], "lxml").body.children)),
                selectors=d['selectors'],
                snippet=next(iter(BeautifulSoup(d['snippet'], "lxml").body.children)),
                event=d['event']
            )

        return {
            'tree_steps': preprocessed_dict['tree_steps'],
            'preprocessed_steps': [_dict_to_step_item(_) for _ in preprocessed_dict['preprocessed_steps']]
        }

    def __getitem__(self, index):
        return self.preprocessed_steps[index]

    def __len__(self):
        return len(self.preprocessed_steps)
