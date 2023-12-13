import json

from action_executors.base import ActionExecutor
from replay_context import ReplayContext
from llm import generate

from logger_setup import get_logger

logger = get_logger()


class Calendar(ActionExecutor):
    """Select a date from a calendar."""
    def execute(
            self,
            context: ReplayContext,
            snippet: str,
            tree_id: str,
            retry: int = 3
    ) -> int:
        """Execute an action on the given node."""

        for _ in range(retry):
            answer = self._determine_action(
                context.instruction,
                context.sub_instruction,
                snippet,
                retry
            )

            logger.debug('select_date')
            logger.debug('answer')
            logger.debug(answer)

            if answer['type'] == 'select':
                logger.debug('select date click %s - %s', tree_id, answer['node_id'])
                self.controller.click_element(self.page_id, tree_id, answer['node_id'])
                return 1
            elif answer['type'] == 'navigate':
                logger.debug('navigate click %s - %s', tree_id, answer['node_id'])
                self.controller.click_element(self.page_id, tree_id, answer['node_id'])
                return 0

        raise RuntimeError('failed to select date')

    def _determine_action(self, instruction: str, sub_instruction: str, snippet: str, retry: int = 3):
        """Select a date from a calendar."""

        prompt = f"""
You are given an instruction, an action to select a date in calendar UI and a HTML snippet containing a calendar UI.
You need to provide the node id that you need to be interected with to the instruction.
If there's the target date in the snippet of the calendar UI, you should provide the node id of the target date.
If there's not the target date in the snippet of the calendar UI, you should provide the node id to navigate to the proper page.
If there's no candidate, you should provide -1.
You should provide the type of action as well. the type of action is one of the following: "select", "navigate", "error"

The output format is a JSON object with the following fields:
{{ "node_id": 0, "type": "select" }}

Example outputs:
- {{ "node_id": 1, "type": "navigate" }}
- {{ "node_id": 2, "type": "select" }}
- {{ "node_id": -1, "type": "error" }}

instruction: {instruction}
action: {sub_instruction}
snippet: {snippet}
"""
        for _ in range(retry):
            answer = generate(prompt)

            logger.debug('select_date')
            logger.debug('prompt')
            logger.debug(prompt[:4096])
            logger.debug('answer')
            logger.debug(answer)

            try:
                return json.loads(answer)
            except:
                logger.exception('failed to parse answer')

        return {"node_id": -1, "type": "error"}
