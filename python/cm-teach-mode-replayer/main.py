import argparse
import copy
import logging
import time
import pandas as pd

from bunny_controller import BunnyController
from bs4 import BeautifulSoup

import html_utils
from recording import Recording
from planner import GPT4Planner
from replay_context import ReplayContext
from action_executors import create_action_executor

from logger_setup import setup_logger

logger = setup_logger()


class TeachModeReplayer:
    """Teach mode replayer."""

    def __init__(
        self,
        recording_instruction: str,
        recording: Recording,
        controller: BunnyController,
    ):
        self.recording_instruction = recording_instruction
        self.recording = recording
        self.controller = controller
        self.planner = GPT4Planner()
        self.sub_tasks = None
        self.reference_sub_tasks = None

    def breakdown_recorded_instruction(self, node_id_attr="__bunny_node_id") -> None:
        """Breakdown instruction into sub-instructions."""
        def _to_action(step):
            event = step.event
            snippet = step.snippet
            if snippet.attrs.get(node_id_attr) == step.target_node_id:
                snippet = html_utils.remove_attributes(
                    copy.deepcopy(snippet), remove_attrs=[node_id_attr]
                )
                target_element_string = str(snippet)
            else:
                target_element = snippet.find(attrs={node_id_attr: step.target_node_id})
                snippet = html_utils.remove_attributes(
                    copy.deepcopy(snippet), remove_attrs=[node_id_attr]
                )
                target_element = html_utils.remove_attributes(
                    copy.deepcopy(target_element), remove_attrs=[node_id_attr]
                )

                target_element_string = f"{target_element} in {snippet}"

            if event[0] == "click":
                return f"click {target_element_string}"
            if event[0] == "fill":
                return f"fill {target_element_string} with {event[1]}"

            raise NotImplementedError

        actions = [_to_action(_) for _ in self.recording]
        self.reference_sub_tasks = self.planner.breakdown_instruction(
            self.recording_instruction, actions
        )
        return self.reference_sub_tasks

    def plan(self, instruction) -> None:
        """Plan sub-tasks."""
        self.sub_tasks = self.planner.plan_sub_instructions(
            instruction, self.recording_instruction, self.reference_sub_tasks
        )
        return self.sub_tasks

    def replay(self, page_id, instruction, node_id_attr="__bunny_node_id") -> None:
        """Replay instruction."""
        reference_sub_instructions = []
        for sub_task in self.reference_sub_tasks:
            for sub_instruction in sub_task['sub-instructions']:
                reference_sub_instructions.append(sub_instruction['description'])

        replay_context = ReplayContext(
            instruction=instruction,
            sub_tasks=self.sub_tasks,
            references=self.recording,
            reference_instruction=self.recording_instruction,
            reference_sub_instructions=reference_sub_instructions
        )

        while replay_context.has_next():
            sub_instruction_type = replay_context.sub_instruction['type']
            reference_event = replay_context.reference.event[0]

            action_type = 'calendar' if sub_instruction_type == 'calendar' else reference_event
            action_executor = create_action_executor(action_type, self.controller, page_id)

            next_step = action_executor(replay_context)
            if next_step:
                replay_context.step()

            time.sleep(5.0)


def run_single_instruction(
        bunny_host_url,
        context_id,
        page_id,
        record_file,
        record_instruction,
        replay_instruction,
):
    """Run single instruction."""
    logger.info("record_instruction: %s", record_instruction)
    logger.info("replay_instruction: %s", replay_instruction)

    recording = Recording(record_file)

    bunny_controller = BunnyController(bunny_host_url, context_id)
    bunny_controller.create_context()
    bunny_controller.create_tab(page_id)
    for _ in range(3):
        try:
            bunny_controller.navigate_to_website(page_id, recording[0].url)

            replayer = TeachModeReplayer(record_instruction, recording, bunny_controller)
            replayer.breakdown_recorded_instruction()
            replayer.plan(replay_instruction)
            replayer.replay(page_id, replay_instruction)
            break
        except Exception as e:
            logger.exception('run_single_instruction')
            logger.debug(e)
    time.sleep(2.0)


def run_test(
        bunny_host_url,
        context_id,
        page_id,
        test_instruction_filepath
):
    """Run test."""
    df_test_instruction = pd.read_csv(test_instruction_filepath)

    bunny_controller = BunnyController(bunny_host_url, context_id)
    bunny_controller.create_context()
    bunny_controller.create_tab(page_id)

    records = []
    for record_file, df_instructions in df_test_instruction.groupby('record_file'):
        recording = Recording(record_file)

        for _, row in df_instructions.iterrows():
            record_instruction = row['record_instruction']
            replay_instruction = row['replay_instruction']

            logger.info("record_instruction: %s", record_instruction)
            logger.info("replay_instruction: %s", replay_instruction)

            try_count = 0
            success = False
            for _ in range(3):
                try_count += 1
                try:
                    bunny_controller.navigate_to_website(page_id, recording[0].url)

                    replayer = TeachModeReplayer(record_instruction, recording, bunny_controller)
                    replayer.breakdown_recorded_instruction()
                    replayer.plan(replay_instruction)
                    replayer.replay(page_id, replay_instruction)

                    # This doesn't mean the replay is successful.
                    # It just means the replay is done without error.
                    success = True
                    break
                except Exception as e:
                    logger.exception('run_test %s', replay_instruction)
                    logger.debug(e)

            records.append((record_file, record_instruction, replay_instruction, success, try_count))
    
    df_result = pd.DataFrame(records, columns=['record_file', 'record_instruction', 'replay_instruction', 'success', 'try_count'])
    df_result.to_csv('test_result.csv', index=False)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--record-file", type=str)
    parser.add_argument(
        "--bunny-host-url", type=str, default="http://localhost:8080/apis/webAction"
    )
    parser.add_argument("--context-id", type=str, default="ctx0")
    parser.add_argument("--page-id", type=str, default="page0")
    parser.add_argument(
        "--record-instruction",
        type=str,
        default="Search senorita and play song radio of it"
    )
    parser.add_argument(
        "--replay-instruction",
        type=str,
        default="Play Ditto by NewJeans song radio"
    )


    parser.add_argument("--test-instruction-filepath", type=str, default=None)

    args = parser.parse_args()

    logger.setLevel(logging.DEBUG)
    logging.basicConfig(level=logging.INFO)

    if args.test_instruction_filepath is None:
        run_single_instruction(
            args.bunny_host_url,
            args.context_id,
            args.page_id,
            args.record_file,
            args.record_instruction,
            args.replay_instruction
        )
    else:
        run_test(
            args.bunny_host_url,
            args.context_id,
            args.page_id,
            args.test_instruction_filepath
        )


if __name__ == "__main__":
    main()
