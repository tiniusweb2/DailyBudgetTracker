export interface User {
  id: number;
  username: string;
  password: string;
  dailyBudgetAmount: number;
  createdAt: Date;
}

export interface CreateUser {
  username: string;
  password: string;
  dailyBudgetAmount?: number;
}

export interface UpdateUser {
  dailyBudgetAmount?: number;
  password?: string;
}

export interface UserRepository {
  findById(id: number): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  create(data: CreateUser): Promise<User>;
  update(id: number, data: UpdateUser): Promise<User>;
  verifyCredentials(username: string, password: string): Promise<User | null>;
}
