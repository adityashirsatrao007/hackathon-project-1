class Scope:
    def __init__(self):
        self.user = {}
        self.tags = {}
        self.breadcrumbs = []

    def set_user(self, user):
        self.user = user

    def set_tag(self, key, value):
        self.tags[key] = value

    def add_breadcrumb(self, message):
        self.breadcrumbs.append({"message": message})

    def get(self):
        return {
            "user": self.user,
            "tags": self.tags,
            "breadcrumbs": self.breadcrumbs[-20:]
        }