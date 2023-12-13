"""Replay context."""

class ReplayContext:
    """Execution context."""
    def __init__(
        self,
        instruction: str,
        sub_tasks: list,
        references: list,
        reference_instruction: str,
        reference_sub_instructions: list
    ):
        """Initialize ExecutionContext."""
        self._instruction = instruction 
        self._sub_tasks = sub_tasks

        self._references = references
        self._reference_instruction = reference_instruction
        self._reference_sub_instructions = reference_sub_instructions

        self._previous_sub_instructions = []
        self._current_sub_task_index = 0
        self._current_sub_instruction_index = 0

    @property
    def instruction(self):
        """Return the instruction."""
        return self._instruction

    @property
    def sub_tasks(self):
        """Return the sub tasks."""
        return self._sub_tasks

    @property
    def sub_task(self):
        """Return the sub task."""
        return self._sub_tasks[self._current_sub_task_index]

    @property
    def sub_instructions(self):
        """Return the sub instructions."""
        return self.sub_task['sub-instructions']

    @property
    def sub_instruction(self):
        """Return the sub instruction."""
        return self.sub_instructions[self._current_sub_instruction_index]

    @property
    def reference_instruction(self):
        """Return the reference instruction."""
        return self._reference_instruction
    
    @property
    def reference_sub_instructions(self):
        """Return the reference sub instructions."""
        return self._reference_sub_instructions
    
    @property
    def previous_sub_instructions(self):
        """Return the previous sub instructions."""
        return self._previous_sub_instructions

    @property
    def reference(self):
        """Return the reference."""
        return self._references[self.sub_instruction['reference_index']]

    @property
    def reference_sub_instruction(self):
        """Return the reference sub instruction."""
        return self.reference_sub_instructions[self.sub_instruction['reference_index']]

    def step(self):
        """Step to the next sub instruction."""
        self._previous_sub_instructions.append(self.sub_instruction)
        if self._current_sub_instruction_index + 1 == len(self.sub_instructions):
            self._current_sub_instruction_index = 0
            self._current_sub_task_index += 1
        else:
            self._current_sub_instruction_index += 1

    def has_next(self):
        """Return whether there's next sub instruction."""
        return self._current_sub_task_index < len(self.sub_tasks)