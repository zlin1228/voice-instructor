import re
from itertools import combinations, product
from collections import defaultdict


from bs4 import BeautifulSoup

from logger_setup import get_logger

logger = get_logger()


def get_path_to_target(node, target_id, node_id_attr='__bunny_node_id'):
    """Get path to target node."""
    bunny_id = str(node.attrs.get(node_id_attr, -1))

    if bunny_id == target_id:
        return [node]

    for child in node.children:
        if child.name is None:
            continue

        path = get_path_to_target(child, target_id)
        if path is not None:
            return [node] + path
    
    return None


def get_unique_selectors(root, node, node_id_attr='__bunny_node_id'):
    """Get unique selectors."""
    tag = node.name
    attrs = [_ for _ in node.attrs.items() if _[0] in ['type', 'role']]
    classes = node.get('class', [])[:1]

    selectors = []
    # using two attributes
    for clazz, (attr0, attr1) in product(classes, combinations(attrs, 2)):
        attrs_dict = {attr0[0]: attr0[1], attr1[0]: attr1[1]}
        selected = root.find_all(tag, attrs=attrs_dict, class_=clazz)
        if len(selected) == 1:
            selectors.append({'tag': tag, 'attrs': attrs_dict, 'class': clazz})

    for (attr0, attr1) in combinations(attrs, 2):
        attrs_dict = {attr0[0]: attr0[1], attr1[0]: attr1[1]}
        selected = root.find_all(tag, attrs=attrs_dict)
        if len(selected) == 1:
            selectors.append({'tag': tag, 'attrs': attrs_dict})

    # using a attribute
    for clazz, attr in product(classes, attrs):
        attrs_dict = {attr[0]: attr[1]}
        selected = root.find_all(tag, attrs=attrs_dict, class_=clazz)
        if len(selected) == 1:
            selectors.append({'tag': tag, 'attrs': attrs_dict, 'class': clazz})

    for attr in attrs:
        attrs_dict = {attr[0]: attr[1]}
        selected = root.find_all(tag, attrs=attrs_dict)
        if len(selected) == 1:
            selectors.append({'tag': tag, 'attrs': attrs_dict})

    if len(classes) != 0:
        selected = root.find_all(tag, class_=classes[0])
        if len(selected) == 1:
            selectors.append({'tag': tag, 'attrs': {}, 'class': classes[0]})

    return selectors


def get_multiple_selectors(root, node, node_id_attr='__bunny_node_id'):
    """Get multiple selectors."""
    tag = node.name
    attrs = [_ for _ in node.attrs.items() if _[0] != node_id_attr and _[0] in ['type', 'role']]
    classes = node.get('class', [])[:1]

    selectors = []
    # using two attributes
    for clazz, (attr0, attr1) in product(classes, combinations(attrs, 2)):
        attrs_dict = {attr0[0]: attr0[1], attr1[0]: attr1[1]}
        selected = root.find_all(tag, attrs=attrs_dict, class_=clazz)
        if len(selected) > 1:
            selectors.append({'tag': tag, 'attrs': attrs_dict, 'class': clazz})

    for (attr0, attr1) in combinations(attrs, 2):
        attrs_dict = {attr0[0]: attr0[1], attr1[0]: attr1[1]}
        selected = root.find_all(tag, attrs=attrs_dict)
        if len(selected) > 1:
            selectors.append({'tag': tag, 'attrs': attrs_dict})

    # using a attribute
    for clazz, attr in product(classes, attrs):
        attrs_dict = {attr[0]: attr[1]}
        selected = root.find_all(tag, attrs=attrs_dict, class_=clazz)
        if len(selected) > 1:
            selectors.append({'tag': tag, 'attrs': attrs_dict, 'class': clazz})

    for attr in attrs:
        attrs_dict = {attr[0]: attr[1]}
        selected = root.find_all(tag, attrs=attrs_dict)
        if len(selected) > 1:
            selectors.append({'tag': tag, 'attrs': attrs_dict})

    if len(classes) != 0:
        selected = root.find_all(tag, class_=classes[0])
        if len(selected) > 1:
            selectors.append({'tag': tag, 'attrs': {}, 'class': classes[0]})

    return selectors


def remove_invisible(
        soup: BeautifulSoup,
        target_node_id: str = None,
        node_id_attr: str = '__bunny_node_id',
        keep_tag_name: str = None
):
    """Recursively remove and reparent."""
    # TODO: reimplement this
    for child in soup.find_all(recursive=False):
        remove_invisible(child, target_node_id=target_node_id, node_id_attr=node_id_attr, keep_tag_name=keep_tag_name)

        if child.attrs.get('data-visible', None) == 'false':
            child.decompose()

    return soup


def build_selectors(nodes, node_id_attr='__bunny_node_id'):
    """Build selectors."""
    selectors_dict = defaultdict(list)
    for from_idx in range(len(nodes) - 1):
        from_node = nodes[from_idx]
        if from_idx == 0:
            from_node_id = 'root_node'
        else:
            from_node_id = from_node.attrs.get(node_id_attr)

        for to_node in nodes[from_idx+1:]:
            to_node_id = to_node.attrs.get(node_id_attr)
            if to_node_id is None:
                continue

            selectors_dict[from_node_id].append({
                'to': to_node_id,
                'unique_selectors': get_unique_selectors(from_node, to_node),
                'multiple_selectors': get_multiple_selectors(from_node, to_node)
            })

    return dict(selectors_dict)


def follow_unique_selectors(root, root_node_id, root_selectors, selectors_dict, node_id_attr='__bunny_node_id'):
    """Follow selectors."""
    unique_nodes = [(root_node_id, root)]

    for selector in root_selectors[::-1]:
        node_id = selector['to']
        node_selectors = selector['unique_selectors']

        for node_selector in node_selectors:
            clazz = node_selector.get('class', None)
            if clazz is not None:
                selected = root.find_all(node_selector['tag'], attrs=node_selector['attrs'], class_=clazz)
            else:
                selected = root.find_all(node_selector['tag'], attrs=node_selector['attrs'])

            if len(selected) == 1:
                if clazz is not None:
                    logger.debug('selected unique item, %s %s %s', node_selector['tag'], node_selector['attrs'], clazz)
                else:
                    logger.debug('selected unique item, %s %s', node_selector['tag'], node_selector['attrs'])
                unique_nodes.extend(follow_unique_selectors(selected[0], node_id, selectors_dict.get(node_id, []), selectors_dict))
                break

        if len(unique_nodes) > 1:
            break

    return unique_nodes[-1:]


def follow_multiple_selectors(root, root_selectors, node_id_attr='__bunny_node_id'):
    multiple_nodes = [[root]]
    # from deepest
    for selector in root_selectors[::-1]:
        node_selectors = selector['multiple_selectors']

        for node_selector in node_selectors:
            clazz = node_selector.get('class', None)
            if clazz is not None:
                selected = root.find_all(node_selector['tag'], attrs=node_selector['attrs'], class_=clazz)
            else:
                selected = root.find_all(node_selector['tag'], attrs=node_selector['attrs'])

            if len(selected) > 1:
                if clazz is not None:
                    logger.debug('selected %d items, %s %s %s', len(selected), node_selector['tag'], node_selector['attrs'], clazz)
                else:
                    logger.debug('selected %d items, %s %s', len(selected), node_selector['tag'], node_selector['attrs'])
                multiple_nodes.append(selected)
                break

        if len(multiple_nodes) > 1:
            break

    return multiple_nodes[-1:]


def find_lowest_common_ancestor(soup, nodes):
    """Find lowest common ancestor."""

    def _find_path_to_node(node, target):
        """Find path to node."""
        path = []
        while node is not None:
            path.append(node)
            if node == target:
                break
            node = node.parent
        return path

    if not nodes:
        return None

    # Find paths from the root to each node
    paths = [_find_path_to_node(node, soup) for node in nodes]
    common_ancestors = set(paths[0])
    for path in paths[1:]:
        common_ancestors.intersection_update(path)

    lowest_common_ancestor = list(sorted(list(common_ancestors), key=lambda x: len(_find_path_to_node(x, soup))))[-1]

    return lowest_common_ancestor


def follow_selectors(root, selectors_dict, node_id_attr='__bunny_node_id'):
    """Follow selectors to the smallest subtree."""
    lowest_node_id, lowest_unique_node = follow_unique_selectors(root, 'root_node', selectors_dict['root_node'], selectors_dict, node_id_attr=node_id_attr)[0]
    if selectors_dict.get(lowest_node_id, None) is None:
        return lowest_unique_node

    node_list = follow_multiple_selectors(lowest_unique_node, selectors_dict[lowest_node_id], node_id_attr=node_id_attr)[0]

    if len(node_list) == 1:
        return node_list[0]

    # find the lowest common parent
    lca = find_lowest_common_ancestor(lowest_unique_node, node_list)

    logger.debug('unique %d -> lcs %d', len(str(lowest_unique_node)), len(str(lca)))
    return lca


def remove_nodes_by_tag_name(
        soup: BeautifulSoup,
        tags: list[str],
        target_node_id: str = None,
        node_id_attr: str = '__bunny_node_id'
):
    """Remove nodes by tag name."""
    target_node_id = str(target_node_id)

    for tag in tags:
        for element in soup.select(tag):
            if (element.attrs.get(node_id_attr, None) == target_node_id or
                element.find(attrs={node_id_attr: target_node_id}) is not None):
                continue

            element.extract()
    return soup


def remove_attributes(
        soup: BeautifulSoup,
        keep_attrs: list[str] = None,
        remove_attrs: list[str] = None,
):
    """Remove attributes."""
    soup.attrs = {key:value for key,value in soup.attrs.items()
                  if (keep_attrs is None or key in keep_attrs) and (remove_attrs is None or key not in remove_attrs)}

    for tag in soup.recursiveChildGenerator():
        try:
            tag.attrs = {key:value for key,value in tag.attrs.items()
                         if (keep_attrs is None or key in keep_attrs) and (remove_attrs is None or key not in remove_attrs)}
        except AttributeError:
            # 'NavigableString' object has no attribute 'attrs'
            pass
    return soup


def contract_edge(
        soup: BeautifulSoup,
        target_node_id: str = None,
        node_id_attr: str = '__bunny_node_id',
        keep_tag_name: str = None
):
    """Recursively remove and reparent."""
    for child in soup.find_all(recursive=False):
        contract_edge(child, target_node_id=target_node_id, node_id_attr=node_id_attr, keep_tag_name=keep_tag_name)

        node_id = child.attrs.get(node_id_attr, None)
        if node_id is not None and node_id == target_node_id:
            continue

        if child.name == keep_tag_name:
            continue

        text = child.string
        text = '' if text is None else text.strip()
        text += extract_description_attributes(child, recursive=False)

        if text != '':
            continue

        if len(child.find_all(recursive=False)) == 0 and len(child.attrs) == 1:
            child.decompose()

        if len(child.find_all(recursive=False)) == 1 and len(child.attrs) == 1:
            parent = child.find_parent()
            child_contents = child.contents
            for content in child_contents:
                parent.append(content)
            child.parent = soup
            child.decompose()

    return soup


def find_node_by_id(
        root_node: BeautifulSoup,
        target_node_id: str,
        node_id_attr: str = '__bunny_node_id'
):
    """Find node by id."""
    if root_node.attrs.get(node_id_attr, None) == target_node_id:
        return root_node

    return root_node.find(attrs={node_id_attr: target_node_id})


def simplify_html(
        soup: BeautifulSoup,
        target_node_id: str = None,
        do_contract_edge: bool = True,
        keep_tag_name: str = None,
        node_id_attr: str = '__bunny_node_id'
):
    """Simplify the html to make it easier to use locating the elements to be interacted with."""
    soup = remove_nodes_by_tag_name(
        soup,
        ['script', 'noscript', 'meta', 'head', 'style'],
        target_node_id=target_node_id,
        node_id_attr=node_id_attr
    )
    keep_attrs = ['id', 'aria-label', 'type', 'value', 'name', 'placeholder', 'role', 'data-testid', 'data-visible', node_id_attr]
    soup = remove_attributes(soup, keep_attrs=keep_attrs)
    if do_contract_edge:
        soup = contract_edge(soup, target_node_id=target_node_id, node_id_attr=node_id_attr, keep_tag_name=keep_tag_name)
    soup = remove_invisible(soup, target_node_id=target_node_id, node_id_attr=node_id_attr, keep_tag_name=keep_tag_name)

    return soup


def extract_description_attributes(soup, recursive=True):
    """Extract description attributes."""

    descriptions = []
    def _get_description(element):
        alt_attr = element.get('alt')
        aria_label_attr = element.get('aria-label')
        aria_labelledby_attr = element.get('aria-labelledby')
        title_attr = element.get('title')

        if alt_attr:
            descriptions.append(alt_attr)
        if aria_label_attr:
            descriptions.append(aria_label_attr)
        if aria_labelledby_attr:
            label = soup.find(id=aria_labelledby_attr)
            if label:
                descriptions.append(label.text)
        if title_attr:
            descriptions.append(title_attr)

    _get_description(soup)
    if recursive:
        for child in soup.find_all():
            _get_description(child)

    return ' '.join(descriptions)


def get_subtree_having_semantic_meaning(node, minimum_go_up=0):
    """Get the minimal subtree having semantic meaning."""
    if node is None:
        logger.debug('node is None')
        raise RuntimeError('node is None')

    for _ in range(minimum_go_up):
        if node.parent is not None:
            node = node.parent

    while node.get_text('|', strip=True) == '' and extract_description_attributes(node) == '':
        if node.parent is None:
            break

        node = node.parent

    return node
