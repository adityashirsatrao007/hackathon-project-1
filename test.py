from tracelify.client import Tracelify


sdk = Tracelify(
    dsn="https://abcd1234@api.tracelify.io:8080/1",
    release="1.0.0"
)

sdk.set_user({"id": "user_101"})
sdk.set_tag("env", "Production")

sdk.add_breadcrumb("App started")
sdk.add_breadcrumb("User clicked button")

try:
    x = 10 / 0
except Exception as e:
    sdk.capture_exception(e)

# IMPORTANT: flush() waits for the background worker to send the event
# before the script exits — without this, events may be dropped.
sdk.flush(timeout=10)

print("✅ Done")