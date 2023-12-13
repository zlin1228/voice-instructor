
from action_executors.base import ActionExecutor
from replay_context import ReplayContext
from llm import generate

from logger_setup import get_logger

logger = get_logger()


class Click(ActionExecutor):
    """Click an element."""""
    def execute(
            self,
            context: ReplayContext,
            snippet: str,
            tree_id: str,
            retry: int = 3
    ) -> int:
        """Execute an action on the given node."""

        for _ in range(retry):
            answer = self._determine_action(context, snippet)

            logger.debug('click')
            logger.debug('answer')
            logger.debug(answer)

            logger.debug('click %s - %s', tree_id, answer)
            self.controller.click_element(self.page_id, tree_id, answer)
            return 1

        raise RuntimeError('failed to click')

    def _determine_action(
        self,
        context: ReplayContext,
        snippet: str
    ):
        """Map a sub-instruction to an ui action."""
        previous_sub_instructions = '\n'.join(['- ' + _['description'] for _ in context.previous_sub_instructions])
        prompt = f"""
You are given the following informations.
- reference instruction: the instruction that the user performed.
- reference sub-instruction: the sub-instruction that the user performed to complete the reference instruction.
- reference snippet: the snippet that includes the reference element the user performed on to compete the reference sub-instruction.
- reference target node id: the node id of the reference element that the user performed on.
- instruction: the instruction that you need to complete.
- previous sub-instructions: the sub-instructions that you've performed to complete the instruction.
- sub-instruction: the sub-instruction that you need to perform to complete the instruction.
- snippet: the html snippet that contains the target element that you need to perform on.

You need to provide the node id of the <{context.reference.target_node.name}> element from snippet that need to be interacted with to accomplish the sub-instruction refering given information.
If there're multiple candidates, you need to provide the node id of the first one.
If there's no candidate, you should provide -1.
You should provide the node id value only, not including any other text.

reference instruction: {context.reference_instruction}
reference sub-instruction: {context.reference_sub_instruction}
reference snippet: {context.reference.snippet}
reference node id: {context.reference.target_node_id}
instruction: {context.instruction}
previous sub-instructions:
{previous_sub_instructions}
sub-instruction: {context.sub_instruction}
snippet: {snippet}
"""
        answer = generate(prompt)

        logger.debug('map_sub_instruction_to_action')
        logger.debug('prompt')
        logger.debug(prompt[:4096])
        logger.debug('answer')
        logger.debug(answer)

        try:
            return int(answer)
        except:
            logger.exception('failed to determine the target node')
            return -1
