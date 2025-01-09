export interface Transaction {
  id: number;
  userId: number;
  amount: number;
  description: string;
  createdAt: Date;
}

export interface CreateTransaction {
  userId: number;
  amount: number;
  description: string;
}

export interface UpdateTransaction {
  amount?: number;
  description?: string;
}

export interface TransactionRepository {
  findById(id: number): Promise<Transaction | null>;
  findByUserId(userId: number): Promise<Transaction[]>;
  create(data: CreateTransaction): Promise<Transaction>;
  update(id: number, data: UpdateTransaction): Promise<Transaction>;
  delete(id: number): Promise<void>;
}
