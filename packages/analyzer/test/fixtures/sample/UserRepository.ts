import { Database } from "./Database.js";
import type { Repository } from "./Repository.js";

export interface User {
  id: string;
  name: string;
}

export class UserRepository implements Repository<User> {
  constructor(private readonly db: Database) {}

  findById(id: string): User | undefined {
    this.db.query("SELECT * FROM users WHERE id = ?");
    return { id, name: "test" };
  }
}
