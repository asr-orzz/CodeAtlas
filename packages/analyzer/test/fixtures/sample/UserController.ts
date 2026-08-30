import { UserService } from "./UserService.js";

export class UserController {
  constructor(private readonly service: UserService) {}

  async show(id: string): Promise<unknown> {
    const user = await this.service.getUser(id);
    return user;
  }
}
