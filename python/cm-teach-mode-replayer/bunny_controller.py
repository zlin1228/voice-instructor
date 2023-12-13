import requests
import json

from logger_setup import get_logger

logger = get_logger()


class BunnyController:
    HEADERS = {
        "Content-Type": "application/json"
    }

    def __init__(
            self,
            url: str,
            context_id: str) -> None:
        """Initialize BunnyController."""
        self.url = url
        self.context_id = context_id

    def _post(self, data: dict) -> str:
        """Send POST request."""
        response = requests.post(
            self.url,
            data=json.dumps(data),
            headers=self.HEADERS
        )

        if response.status_code == 200:
            logger.debug("POST request was successful.")
            logger.debug("Response content: %s", response.text[:100])
            return response.json()
        else:
            logger.debug("POST request failed with status code %s", response.status_code)
            return None

    def list_contexts(self) -> bool:
        """List all contexts and pages."""
        data = {
            "listContexts": {}
        }
        return self._post(data)

    def create_context(self) -> bool:
        """Create a context."""
        data = {
            "createContext": {
                "contextId": self.context_id
            }
        }
        return self._post(data)
    
    def create_tab(self, page_id: str) -> bool:
        """Create a tab."""
        data = {
            "createPage": {
                "contextId": self.context_id,
                "pageId": page_id
            }
        }
        return self._post(data)

    def navigate_to_website(self, page_id: str, url: str) -> bool:
        """Navigate to a website."""
        data = {
            "singlePageAction": {
                "pageId": page_id,
                "pageAction": {
                    "navigate": {
                        "url": url
                    }
                }
            }
        }
        return self._post(data)

    def fetch_web_dom(self, page_id: str) -> bool:
        """Fetch the Web DOM as a tree."""
        data = {
            "singlePageAction": {
                "pageId": page_id,
                "pageAction": {
                    "treeAction": {
                        "fetch": {}
                    }
                }
            }
        }
        return self._post(data)

    def click_element(self, page_id: str, tree_id: str, node_id: str) -> bool:
        """Click an element."""
        data = {
            "singlePageAction": {
                "pageId": page_id,
                "pageAction": {
                    "treeAction": {
                        "operation": {
                            "operation": {
                                "click": {
                                    "nodeLocation": {
                                        "treeId": tree_id,
                                        "nodeId": node_id
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        return self._post(data)

    def fill_text(self, page_id: str, tree_id: str, node_id: str, text: str) -> bool:
        """Fill text into an element."""
        data = {
            "singlePageAction": {
                "pageId": page_id,
                "pageAction": {
                    "treeAction": {
                        "operation": {
                            "operation": {
                                "fill": {
                                    "nodeLocation": {
                                        "treeId": tree_id,
                                        "nodeId": node_id
                                    },
                                    "value": text
                                }
                            }
                        }
                    }
                }
            }
        }
        return self._post(data)

    def scroll_element(self, page_id: str, tree_id: str, node_id: str, position_y: float) -> bool:
        """Click an element."""
        data = {
            "singlePageAction": {
                "pageId": page_id,
                "pageAction": {
                    "treeAction": {
                        "operation": {
                            "operation": {
                                "scroll": {
                                    "nodeLocation": {
                                        "treeId": tree_id,
                                        "nodeId": node_id
                                    },
                                    "positionX": 0,
                                    "positionY": position_y
                                }
                            }
                        }
                    }
                }
            }
        }
        print(data)
        return self._post(data)
