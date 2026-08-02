import requests
from loguru import logger


def send_event(config, data: dict) -> None:
    """
    Send a single event to the Tracelify backend.
    Endpoint: POST /api/{project_id}/events
    Auth: Authorization: Bearer <public_key>
    """
    print(data)
    try:
        url = config.get_endpoint()
        headers = config.get_headers()

        response = requests.post(
            url,
            json=data,
            headers=headers,
            timeout=5,
        )

        if response.status_code == 202:
            logger.debug(f"✅ Event {data.get('event_id', '?')} accepted by Tracelify")
        else:
            logger.warning(
                f"⚠️  Tracelify responded {response.status_code}: {response.text[:200]}"
            )

    except requests.exceptions.ConnectionError:
        logger.error("❌ Tracelify backend unreachable — event dropped")
    except requests.exceptions.Timeout:
        logger.error("❌ Tracelify backend timed out — event dropped")
    except Exception as exc:
        logger.error(f"❌ Unexpected error sending event: {exc}")