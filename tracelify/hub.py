_current_client = None

def set_client(client):
    global _current_client
    _current_client = client

def get_client():
    return _current_client