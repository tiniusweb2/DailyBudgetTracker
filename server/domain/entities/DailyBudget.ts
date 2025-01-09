export interface DailyBudget {
  id: number;
  userId: number;
  date: Date;
  budgetAmount: number;
  spent: number;
  saved: number;
  createdAt: Date;
}

export interface CreateDailyBudget {
  userId: number;
  date: Date;
  budgetAmount: number;
  spent?: number;
  saved?: number;
}

export interface UpdateDailyBudget {
  spent?: number;
  saved?: number;
  budgetAmount?: number;
}

export interface DailyBudgetRepository {
  findById(id: number): Promise<DailyBudget | null>;
  findByUserIdAndDate(userId: number, date: Date): Promise<DailyBudget | null>;
  findByUserId(userId: number): Promise<DailyBudget[]>;
  create(data: CreateDailyBudget): Promise<DailyBudget>;
  update(id: number, data: UpdateDailyBudget): Promise<DailyBudget>;
  getCurrentDayBudget(userId: number): Promise<DailyBudget>;
}
