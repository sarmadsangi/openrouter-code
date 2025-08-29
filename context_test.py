class UserService:
    def __init__(self):
        self.users = []
        self.active_sessions = {}
    
    def authenticate_user(self, username, password):
        # Find user in database
        user = self.find_user_by_username(username)
        if not user:
            raise AuthenticationError("User not found")
        
        # Check password
        if self.verify_password(user, password):
            # Create session
            session_id = self.create_session(user)
            return session_id
        return None
    
    def find_user_by_username(self, username):
        for user in self.users:
            if user.username == username:
                return user
        return None
    
    def verify_password(self, user, password):
        # Simple password check (should use hashing in production)
        return user.password == password
    
    def create_session(self, user):
        import uuid
        session_id = str(uuid.uuid4())
        self.active_sessions[session_id] = user
        return session_id