from urllib.parse import urlparse


class Config:
    def __init__(self, dsn, release):
        """
        Parse DSN formats:
          http://<public_key>@<host>:<port>/api/<project_id>/events   ← backend-generated
          http://<public_key>@<host>:<port>/api/<project_id>           ← short form
          http://<public_key>@<host>:<port>/<project_id>               ← legacy

        Example:
          http://abc123@localhost:8000/api/550e8400-e29b-41d4-a716-.../events
        """
        parsed = urlparse(dsn)

        self.protocol = parsed.scheme or "http"
        self.host = parsed.hostname or "localhost"
        self.port = parsed.port or 8000
        self.public_key = parsed.username or "demo_key"

        # Path: /api/<project_id>/events  → strip leading slash, split
        path_parts = [p for p in parsed.path.strip("/").split("/") if p]

        # Drop "api" prefix and "events" suffix if present
        if path_parts and path_parts[0] == "api":
            path_parts = path_parts[1:]
        if path_parts and path_parts[-1] == "events":
            path_parts = path_parts[:-1]

        self.project_id = path_parts[0] if path_parts else "unknown"
        self.release = release

    def get_endpoint(self) -> str:
        """Returns the full ingest URL for this project."""
        base = f"{self.protocol}://{self.host}:{self.port}"
        return f"{base}/api/{self.project_id}/events"

    def get_headers(self) -> dict:
        """Returns auth headers to send with every event."""
        return {
            "Authorization": f"Bearer {self.public_key}",
            "Content-Type": "application/json",
        }