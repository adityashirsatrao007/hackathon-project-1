from .config import Config
from .hub import set_client
from .scope import Scope
from .queue import event_queue
from .worker import start_worker, _flush
from .handlers import setup_global_handler
from .utils import get_runtime_context, get_timestamp, generate_event_id
import traceback


class Tracelify:

    def __init__(self, dsn, release):
        self.config = Config(dsn, release=release)
        self.scope = Scope()

        # register global client
        set_client(self)

        # start background worker
        start_worker(self.config)

        # enable auto error capture
        setup_global_handler()

    def capture_exception(self, error, stacktrace=None, level="error", fingerprint=None):

        if stacktrace is None:
            tb = getattr(error, "__traceback__", None)

            if tb is not None:
                stacktrace = traceback.format_exception(type(error), error, tb)
            else:
                stacktrace = traceback.format_stack()

        # ✅ FIX 1: convert list → string
        if isinstance(stacktrace, list):
            stacktrace = "".join(stacktrace)

        # ✅ FIX 2: fallback if empty
        if not stacktrace:
            stacktrace = "No stacktrace available"

        event = {
            "event_id": generate_event_id(),
            "project_id": self.config.project_id,
            "timestamp": get_timestamp(),
            "level": level,
            "release": self.config.release,
            **(  {"fingerprint": fingerprint} if fingerprint is not None else {}),
            "client": {
                "sdk": "tracelify.python"
            },
            "error": {
                "type": type(error).__name__,
                "message": str(error),
                "stacktrace": stacktrace
            },
            "context": get_runtime_context(),
            **self.scope.get()
        }

        event_queue.put(event)

    def set_user(self, user):
        self.scope.set_user(user)

    def set_tag(self, key, value):
        self.scope.set_tag(key, value)

    def add_breadcrumb(self, message):
        self.scope.add_breadcrumb(message)

    def flush(self, timeout: float = 5.0) -> None:
        """Block until all queued events are sent (or timeout expires).
        Call this before program exit to ensure no events are lost."""
        _flush(timeout=timeout)