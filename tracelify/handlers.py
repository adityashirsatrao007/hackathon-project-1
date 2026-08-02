import sys
import traceback
from .hub import get_client

def setup_global_handler():

    def handle_exception(exc_type, exc_value, exc_traceback):
        # Skip KeyboardInterrupt — don't capture or suppress it.
        if issubclass(exc_type, KeyboardInterrupt):
            sys.__excepthook__(exc_type, exc_value, exc_traceback)
            return

        client = get_client()
        if client:
            stack = traceback.format_exception(exc_type, exc_value, exc_traceback)
            client.capture_exception(exc_value, stack)

        # Always call the default handler so the traceback is still printed.
        sys.__excepthook__(exc_type, exc_value, exc_traceback)

    sys.excepthook = handle_exception