
from bunny_controller import BunnyController
from .click import Click
from .fill import Fill
from .calendar import Calendar

def create_action_executor(
    action_type: str,
    controller: BunnyController,
    page_id: str
):
    """Create an action executor."""
    if action_type == 'click':
        return Click(controller, page_id)

    if action_type == 'fill':
        return Fill(controller, page_id)

    if action_type == 'calendar':
        return Calendar(controller, page_id)

    raise RuntimeError(f'unknown action type: {action_type}')