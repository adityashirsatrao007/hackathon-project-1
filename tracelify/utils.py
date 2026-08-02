import platform
import uuid
from datetime import datetime, timezone

def get_runtime_context():
    return {
        "os": platform.system(),
        "runtime": "python",
        "python_version": platform.python_version()
    }

def get_timestamp():
    return datetime.now(timezone.utc).isoformat()

def generate_event_id():
    """Return a unique hex string (UUID4) for each event."""
    return uuid.uuid4().hex