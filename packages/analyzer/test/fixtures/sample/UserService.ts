import { UserRepository, type User } from "./UserRepository.js";

export class UserService {
  private readonly repo: UserRepository;

  constructor() {
    this.repo = new UserRepository(null as never);
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.repo.findById(id);
  }
}
