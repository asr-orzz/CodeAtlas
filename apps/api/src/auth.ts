import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Router, type NextFunction, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import type { Pool } from "pg";
import { config } from "./config.js";
import { asyncHandler, HttpError } from "./http.js";

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface UserRecord extends User {
  passwordHash: string;
}

/** User persistence. Implemented over Postgres and in memory. */
export interface UserStore {
  create(email: string, name: string, passwordHash: string): Promise<User>;
  findByEmail(email: string): Promise<UserRecord | undefined>;
  findById(id: string): Promise<User | undefined>;
}

/** Request with an authenticated user id attached by requireAuth. */
export interface AuthedRequest extends Request {
  userId?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

function verifyToken(token: string): string | undefined {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (typeof payload === "object" && payload && typeof payload.sub === "string") {
      return payload.sub;
    }
  } catch {
    // fall through
  }
  return undefined;
}

/** Express middleware: require a valid Bearer token, set req.userId. */
export function requireAuth(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new HttpError(401, "Authentication required.");
  }
  const userId = verifyToken(token);
  if (!userId) throw new HttpError(401, "Invalid or expired token.");
  req.userId = userId;
  next();
}

function publicUser(u: User) {
  return { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt };
}

/** Router for /auth/register, /auth/login, /auth/me. */
export function createAuthRoutes(users: UserStore): Router {
  const router = Router();

  router.post(
    "/register",
    asyncHandler(async (req, res) => {
      const body = (req.body ?? {}) as {
        email?: unknown;
        password?: unknown;
        name?: unknown;
      };
      const email =
        typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";
      const name =
        typeof body.name === "string" && body.name.trim()
          ? body.name.trim()
          : email.split("@")[0] ?? "there";

      if (!EMAIL_RE.test(email)) {
        throw new HttpError(400, "A valid email is required.");
      }
      if (password.length < 8) {
        throw new HttpError(400, "Password must be at least 8 characters.");
      }
      if (await users.findByEmail(email)) {
        throw new HttpError(409, "An account with that email already exists.");
      }

      const user = await users.create(email, name, await hashPassword(password));
      res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
    }),
  );

  router.post(
    "/login",
    asyncHandler(async (req, res) => {
      const body = (req.body ?? {}) as { email?: unknown; password?: unknown };
      const email =
        typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";

      const record = await users.findByEmail(email);
      if (!record || !(await verifyPassword(password, record.passwordHash))) {
        throw new HttpError(401, "Invalid email or password.");
      }
      res.json({ token: signToken(record.id), user: publicUser(record) });
    }),
  );

  router.get(
    "/me",
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res) => {
      const user = req.userId ? await users.findById(req.userId) : undefined;
      if (!user) throw new HttpError(401, "Account no longer exists.");
      res.json({ user: publicUser(user) });
    }),
  );

  return router;
}

/** Postgres-backed user store (production). */
export class PgUserStore implements UserStore {
  constructor(private readonly pool: Pool) {}

  async create(email: string, name: string, passwordHash: string): Promise<User> {
    const user: User = {
      id: randomUUID(),
      email,
      name,
      createdAt: new Date().toISOString(),
    };
    await this.pool.query(
      `INSERT INTO users (id, email, name, password_hash, created_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [user.id, email, name, passwordHash, user.createdAt],
    );
    return user;
  }

  async findByEmail(email: string): Promise<UserRecord | undefined> {
    const { rows } = await this.pool.query(
      `SELECT id, email, name, password_hash, created_at FROM users WHERE email = $1`,
      [email],
    );
    const row = rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      passwordHash: row.password_hash,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  async findById(id: string): Promise<User | undefined> {
    const { rows } = await this.pool.query(
      `SELECT id, email, name, created_at FROM users WHERE id = $1`,
      [id],
    );
    const row = rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}

/** In-memory user store (tests / ephemeral use). */
export class MemoryUserStore implements UserStore {
  private readonly byId = new Map<string, UserRecord>();
  private readonly byEmail = new Map<string, UserRecord>();

  async create(email: string, name: string, passwordHash: string): Promise<User> {
    const record: UserRecord = {
      id: randomUUID(),
      email,
      name,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    this.byId.set(record.id, record);
    this.byEmail.set(email, record);
    return record;
  }

  async findByEmail(email: string): Promise<UserRecord | undefined> {
    return this.byEmail.get(email);
  }

  async findById(id: string): Promise<User | undefined> {
    return this.byId.get(id);
  }
}
