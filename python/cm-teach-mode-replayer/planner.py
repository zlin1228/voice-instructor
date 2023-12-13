import json
import datetime
from llm import generate

from logger_setup import get_logger

logger = get_logger()


class GPT4Planner:
    """A class to plan sub-instructions.
    """
    def __init__(self, model_name='gpt-4'):
        self.model_name = model_name

    def breakdown_instruction(self, instruction, actions, retry=3):
        """Breakdown an instruction into sub-instructions based on the actions."""
        prompt = f"""
Given an instruction and a series of web-page actions to complete the instruction, describe what each action involves in.
You should think of the description in two level of abstraction:
- the first level is the sub-tasks consisted of a set actions
- the second level is the sub-instruction describing actions.

The description of a sub-instruction should be one of the following patterns.
- "click on the [explain-the-element] element"
- "fill on the [explain-the-element] element with [value-to-fill]"
- "select [YYYY-MM-DD] on the calendar

For the date in the calendar action, you should use the format YYYY-MM-DD.
When the year is not clear, use {datetime.date.today().year} as the year.

You should include all the actions in the instruction in the sub-instructions.

The output format is a JSON object with the following fields:
{
    [
        {
            "sub-task": "sub-task",
            "sub-instructions": [{
                "index": 0,
                "description": "sub-instruction"
            }, {
                "index": 1,
                "description": "sub-instruction"
            }]
        },
        {
            "sub-task": "sub-task",
            "sub-instructions": [{
                "index": 2,
                "description": "sub-instruction"
            }]
        }
    ]
}
You should escape the double quotes chacacters in the JSON object. Every string in the JSON object should be double quoted.

Here's an example of the output:
{
    [
        {
            "sub-task": "Select destination",
            "sub-instructions": [{
                "index": 0,
                "description": "click on the [Destination] element"
            }, {
                "index": 1,
                "description": "fill on the [Destination] element with [New York]"
            }]
        },
        {
            "sub-task": "Select check-in date",
            "sub-instructions": [{
                "index": 2,
                "description": "select [2024-01-02] on the calendar"
            }]
        }
    ]
}

instruction: {instruction}
web-page actions:
"""
        prompt += '\n'.join([f'{i}. {_}' for i, _ in enumerate(actions)])

        exception = None
        for _ in range(retry):
            try:
                answer = generate(prompt)

                logger.debug('breakdown_instruction')
                logger.debug('prompt')
                logger.debug(prompt)
                logger.debug('answer')
                logger.debug(answer)

                return json.loads(answer)
            except Exception as e:
                logger.exception('breakdown_instruction')
                exception = e

        raise exception

    def plan_sub_instructions(self, instruction, reference_instruction, reference_sub_instructions, retry=3):
        """Plan sub-instructions to accomplish a given instruction referring to a reference instruction and its sub-instructions."""
        prompt = f"""
Given a reference instruction, reference sub-instructions to complete the reference instruction, and a target instruction, you need to provide sub-instructions to complete the target instruction.

Each sub-instruction should be one of the reference sub-instructions, but can be modified to complete the target instruction.
Each sub-instruction is a single web-page action that can be performed by a user at oneshot.

In addition to it, you should provide the type of the target element that the sub-instruction need to be performed on.
The type of the target element is one of the following: "button", "input", "select", "calendar", "other".

You should provide the index of the reference sub-instructions and the sub-instruction.
The index of the reference sub-instructions should be one of the index value in the reference sub-instructions.


The output format is a JSON object with the following fields:
{
    [
        {
            "sub-task": "sub-task",
            "sub-instructions": [{
                "reference_index": 0,
                "description": "sub-instruction",
                "type": "calendar"
            }, {
                "reference_index": 1,
                "description": "sub-instruction",
                "type": "button"
            }]
        },
        {
            "sub-task": "sub-task",
            "sub-instructions": [{
                "reference_index": 3,
                "description": "sub-instruction",
                "type": "input"
            }]
        }
    ]
}
You should escape the double quotes chacacters in the JSON object. Every string in the JSON object should be double quoted.
You should output the JSON object only, not including any other text.

Here's an example of the output:
{
    [
        {
            "sub-task": "Select destination",
            "sub-instructions": [{
                "reference_index": 0,
                "description": "click on the [Destination] element",
                "type": "button"
            }, {
                "reference_index": 1,
                "description": "fill on the [Destination] element with [New York]",
                "type": "input"
            }]
        },
        {
            "sub-task": "Select check-in date",
            "sub-instructions": [{
                "reference_index": 2,
                "description": "select [2024-01-02] on the calendar",
                "type": "calendar"
            }]
        }
    ]
}

reference instruction: {reference_instruction}
reference sub-instructions: {reference_sub_instructions}

target instruction: {instruction}
target sub-instructions:
"""
        exception = None
        for _ in range(retry):
            try:
                answer = generate(prompt)

                logger.debug('plan_sub_instructions')
                logger.debug('prompt')
                logger.debug(prompt)
                logger.debug('answer')
                logger.debug(answer)

                return json.loads(answer)
            except Exception as e:
                logger.exception('plan_sub_instructions')
                exception = e

        raise exception
