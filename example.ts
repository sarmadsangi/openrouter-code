class UserManager {
    private users: User[] = [];
    private sessions: Map<string, Session> = new Map();

    async authenticateUser(username: string, password: string): Promise<string | null> {
        const user = this.findUserByUsername(username);
        if (!user) {
            return null; // User not found
        }

        const isValid = await this.validatePassword(user, password);
        if (!isValid) {
            return null; // Invalid password
        }

        const sessionId = this.createSession(user);
        return sessionId;
    }

    private findUserByUsername(username: string): User | null {
        const user = this.users.find(u => u.username === username);
        return user || null;
    }

    private async validatePassword(user: User, password: string): Promise<boolean> {
        // In production, use proper password hashing
        return user.password === password;
    }

    private createSession(user: User): string {
        const sessionId = generateSessionId();
        const session = new Session(user, new Date());
        this.sessions.set(sessionId, session);
        return sessionId;
    }

    logout(sessionId: string): boolean {
        return this.sessions.delete(sessionId);
    }
}

interface User {
    id: string;
    username: string;
    password: string;
    email: string;
}

class Session {
    constructor(
        public user: User,
        public createdAt: Date,
        public expiresAt: Date = new Date(Date.now() + 24 * 60 * 60 * 1000)
    ) {}
}

function generateSessionId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}