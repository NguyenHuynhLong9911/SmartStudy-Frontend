import { compare, hash } from "bcryptjs";

export interface IPasswordHasher {
  compare(password: string, passwordHash: string): Promise<boolean>;
  hash(password: string): Promise<string>;
}

export class BcryptPasswordHasher implements IPasswordHasher {
  constructor(private readonly cost: number) {}

  compare(password: string, passwordHash: string): Promise<boolean> {
    return compare(password, passwordHash);
  }

  hash(password: string): Promise<string> {
    return hash(password, this.cost);
  }
}
