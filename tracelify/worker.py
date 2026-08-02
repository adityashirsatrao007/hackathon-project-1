import atexit
import threading
from .queue import event_queue
from .transport import send_event

_worker_thread = None


def start_worker(config):
    global _worker_thread

    def worker():
        while True:
            event = event_queue.get()
            try:
                send_event(config, event)
            finally:
                event_queue.task_done()

    _worker_thread = threading.Thread(target=worker, daemon=True)
    _worker_thread.start()

    # On normal program exit, drain remaining items in the queue (up to 5 s).
    atexit.register(_flush, timeout=5)


def _flush(timeout: float = 5.0) -> None:
    """Block until the queue is empty or timeout expires."""
    import threading
    t = threading.Thread(target=event_queue.join, daemon=True)
    t.start()
    t.join(timeout=timeout)