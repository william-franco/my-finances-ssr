import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type TransactionType = 'income' | 'expense';
type PeriodFilter = 'day' | 'week' | 'month' | 'year' | 'all';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  createdAt: number;
}

interface CategoryData {
  name: string;
  value: number;
  count: number;
}

interface Summary {
  currentBalance: number;
  totalIncome: number;
  totalExpenses: number;
  highestExpense: Transaction | null;
  predominantCategory: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const INCOME_CATEGORIES = [
  'Salário',
  'Freelance',
  'Investimentos',
  'Bônus',
  'Outros'
];

const EXPENSE_CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Moradia',
  'Saúde',
  'Educação',
  'Lazer',
  'Compras',
  'Contas',
  'Outros'
];

const CHART_COLORS = [
  '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#ef4444', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
];

const isClient = typeof window !== 'undefined';

// ============================================================================
// STORAGE SERVICE
// ============================================================================

class StorageService {
  private static readonly STORAGE_KEYS = Object.freeze({
    DARK_MODE: 'darkMode',
    TRANSACTIONS: 'transactions',
  });

  /**
   * Save data to sessionStorage (client-side only)
   */
  static saveToStorage(key: string, value: any): void {
    if (!isClient) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving ${key} to storage:`, error);
    }
  }

  /**
   * Load data from sessionStorage with default fallback (client-side only)
   */
  static loadFromStorage<T>(key: string, defaultValue: T): T {
    if (!isClient) return defaultValue;
    try {
      const saved = sessionStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (error) {
      console.error(`Error loading ${key} from storage:`, error);
      return defaultValue;
    }
  }

  /**
   * Clear all app data from storage (client-side only)
   */
  static clearStorage(): void {
    if (!isClient) return;
    try {
      sessionStorage.removeItem(this.STORAGE_KEYS.DARK_MODE);
      sessionStorage.removeItem(this.STORAGE_KEYS.TRANSACTIONS);
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }

  /**
   * Get storage keys
   */
  static getKeys() {
    return this.STORAGE_KEYS;
  }
}

// ============================================================================
// MODEL LAYER
// ============================================================================

/**
 * Transaction Model - Handles data structure and business logic
 */
class TransactionModel {
  private transactions: Transaction[];

  constructor(initialTransactions: Transaction[] = []) {
    this.transactions = initialTransactions;
  }

  /**
   * Get all transactions
   */
  getAll(): Transaction[] {
    return [...this.transactions];
  }

  /**
   * Add new transaction
   */
  add(transaction: Omit<Transaction, 'id' | 'createdAt'>): Transaction {
    const newTransaction: Transaction = {
      ...transaction,
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now()
    };
    this.transactions.push(newTransaction);
    return newTransaction;
  }

  /**
   * Update existing transaction
   */
  update(id: string, updates: Partial<Transaction>): Transaction | null {
    const index = this.transactions.findIndex(t => t.id === id);
    if (index === -1) return null;

    this.transactions[index] = { ...this.transactions[index], ...updates };
    return this.transactions[index];
  }

  /**
   * Delete transaction by ID
   */
  delete(id: string): boolean {
    const initialLength = this.transactions.length;
    this.transactions = this.transactions.filter(t => t.id !== id);
    return this.transactions.length < initialLength;
  }

  /**
   * Filter transactions by search term
   */
  search(term: string): Transaction[] {
    const lowerTerm = term.toLowerCase();
    return this.transactions.filter(t =>
      t.description.toLowerCase().includes(lowerTerm) ||
      t.category.toLowerCase().includes(lowerTerm)
    );
  }

  /**
   * Filter transactions by date period
   */
  filterByPeriod(period: PeriodFilter): Transaction[] {
    if (period === 'all') return this.getAll();

    const now = new Date();
    const startDate = new Date();

    switch (period) {
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    return this.transactions.filter(t => new Date(t.date) >= startDate);
  }

  /**
   * Calculate summary statistics
   */
  calculateSummary(transactions: Transaction[]): Summary {
    const income = transactions.filter(t => t.type === 'income');
    const expenses = transactions.filter(t => t.type === 'expense');

    const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);

    const highestExpense = expenses.length > 0
      ? expenses.reduce((max, t) => t.amount > max.amount ? t : max)
      : null;

    const categoryCount: Record<string, number> = {};
    expenses.forEach(t => {
      categoryCount[t.category] = (categoryCount[t.category] || 0) + 1;
    });

    const predominantCategory = Object.keys(categoryCount).length > 0
      ? Object.entries(categoryCount).reduce((a, b) => b[1] > a[1] ? b : a)[0]
      : 'N/A';

    return {
      currentBalance: totalIncome - totalExpenses,
      totalIncome,
      totalExpenses,
      highestExpense,
      predominantCategory
    };
  }

  /**
   * Group expenses by category
   */
  getExpensesByCategory(transactions: Transaction[]): CategoryData[] {
    const categoryMap: Record<string, { value: number; count: number }> = {};

    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        if (!categoryMap[t.category]) {
          categoryMap[t.category] = { value: 0, count: 0 };
        }
        categoryMap[t.category].value += t.amount;
        categoryMap[t.category].count += 1;
      });

    return Object.entries(categoryMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value);
  }

  /**
   * Sync with storage
   */
  syncToStorage(): void {
    StorageService.saveToStorage(
      StorageService.getKeys().TRANSACTIONS,
      this.transactions
    );
  }

  /**
   * Load from storage
   */
  static loadFromStorage(): TransactionModel {
    const transactions = StorageService.loadFromStorage<Transaction[]>(
      StorageService.getKeys().TRANSACTIONS,
      []
    );
    return new TransactionModel(transactions);
  }
}

// ============================================================================
// CONTROLLER LAYER
// ============================================================================

/**
 * Transaction Controller - Manages state and coordinates between Model and View
 */
class TransactionController {
  private model: TransactionModel;
  private listeners: Set<() => void>;

  constructor(model: TransactionModel) {
    this.model = model;
    this.listeners = new Set();
  }

  /**
   * Subscribe to changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of changes
   */
  private notify(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Get all transactions
   */
  getTransactions(): Transaction[] {
    return this.model.getAll();
  }

  /**
   * Add new transaction
   */
  addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): void {
    this.model.add(transaction);
    this.model.syncToStorage();
    this.notify();
  }

  /**
   * Update transaction
   */
  updateTransaction(id: string, updates: Partial<Transaction>): void {
    const result = this.model.update(id, updates);
    if (result) {
      this.model.syncToStorage();
      this.notify();
    }
  }

  /**
   * Delete transaction
   */
  deleteTransaction(id: string): void {
    const success = this.model.delete(id);
    if (success) {
      this.model.syncToStorage();
      this.notify();
    }
  }

  /**
   * Search transactions
   */
  searchTransactions(term: string): Transaction[] {
    return this.model.search(term);
  }

  /**
   * Filter by period
   */
  filterByPeriod(period: PeriodFilter): Transaction[] {
    return this.model.filterByPeriod(period);
  }

  /**
   * Get summary
   */
  getSummary(transactions: Transaction[]): Summary {
    return this.model.calculateSummary(transactions);
  }

  /**
   * Get category data for charts
   */
  getCategoryData(transactions: Transaction[]): CategoryData[] {
    return this.model.getExpensesByCategory(transactions);
  }
}

// ============================================================================
// VIEW COMPONENTS
// ============================================================================

/**
 * Header Component with theme toggle
 */
const Header: React.FC<{ darkMode: boolean; toggleTheme: () => void }> = ({
  darkMode,
  toggleTheme
}) => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-title">
          <svg className="header-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h1>Finanças Pessoais</h1>
        </div>
        <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
          {darkMode ? (
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
};

/**
 * Summary Cards Component
 */
const SummaryCards: React.FC<{ summary: Summary }> = ({ summary }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="summary-grid">
      <div className="summary-card balance">
        <div className="card-header">
          <h3>Saldo Atual</h3>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
          </svg>
        </div>
        <p className="card-value">{formatCurrency(summary.currentBalance)}</p>
        <p className="card-label">Receitas - Despesas</p>
      </div>

      <div className="summary-card income">
        <div className="card-header">
          <h3>Total Receitas</h3>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
          </svg>
        </div>
        <p className="card-value">{formatCurrency(summary.totalIncome)}</p>
      </div>

      <div className="summary-card expense">
        <div className="card-header">
          <h3>Total Despesas</h3>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
          </svg>
        </div>
        <p className="card-value">{formatCurrency(summary.totalExpenses)}</p>
      </div>

      <div className="summary-card highlight">
        <div className="card-header">
          <h3>Maior Despesa</h3>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <p className="card-value">
          {summary.highestExpense ? formatCurrency(summary.highestExpense.amount) : 'N/A'}
        </p>
        {summary.highestExpense && (
          <p className="card-label">{summary.highestExpense.description}</p>
        )}
      </div>

      <div className="summary-card category">
        <div className="card-header">
          <h3>Categoria Predominante</h3>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="card-value-text">{summary.predominantCategory}</p>
      </div>
    </div>
  );
};

/**
 * Transaction Form Component
 */
const TransactionForm: React.FC<{
  onSubmit: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void;
  editingTransaction: Transaction | null;
  onCancelEdit: () => void;
}> = ({ onSubmit, editingTransaction, onCancelEdit }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    if (editingTransaction) {
      setDescription(editingTransaction.description);
      setAmount(editingTransaction.amount.toString());
      setType(editingTransaction.type);
      setCategory(editingTransaction.category);
      setDate(editingTransaction.date);
    } else {
      resetForm();
    }
  }, [editingTransaction]);

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setType('expense');
    setCategory('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !category || !date) return;

    onSubmit({
      description,
      amount: parseFloat(amount),
      type,
      category,
      date
    });

    if (!editingTransaction) {
      resetForm();
    }
  };

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <form onSubmit={handleSubmit} className="transaction-form">
      <h2>{editingTransaction ? 'Editar Transação' : 'Nova Transação'}</h2>

      <div className="form-row">
        <div className="form-group">
          <label>Tipo</label>
          <select value={type} onChange={e => setType(e.target.value as TransactionType)}>
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
          </select>
        </div>

        <div className="form-group">
          <label>Categoria</label>
          <select value={category} onChange={e => setCategory(e.target.value)} required>
            <option value="">Selecione...</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label>Descrição</label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Ex: Compra no supermercado"
          required
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>

        <div className="form-group">
          <label>Data</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn-primary">
          {editingTransaction ? 'Atualizar' : 'Adicionar'}
        </button>
        {editingTransaction && (
          <button type="button" onClick={onCancelEdit} className="btn-secondary">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
};

/**
 * Filters Component
 */
const Filters: React.FC<{
  period: PeriodFilter;
  onPeriodChange: (period: PeriodFilter) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}> = ({ period, onPeriodChange, searchTerm, onSearchChange }) => {
  return (
    <div className="filters">
      <div className="search-box">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar transações..."
          value={searchTerm}
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>

      <div className="period-filters">
        {(['day', 'week', 'month', 'year', 'all'] as PeriodFilter[]).map(p => (
          <button
            key={p}
            className={`filter-btn ${period === p ? 'active' : ''}`}
            onClick={() => onPeriodChange(p)}
          >
            {p === 'day' && 'Hoje'}
            {p === 'week' && 'Semana'}
            {p === 'month' && 'Mês'}
            {p === 'year' && 'Ano'}
            {p === 'all' && 'Todos'}
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * Charts Component
 */
const Charts: React.FC<{ categoryData: CategoryData[]; transactions: Transaction[] }> = ({
  categoryData,
  transactions
}) => {
  // Prepare data for bar chart
  const barChartData = categoryData.slice(0, 5);

  // Prepare data for line chart (last 7 days)
  const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date.toISOString().split('T')[0]);
    }
    return days;
  };

  const lineChartData = getLast7Days().map(date => {
    const dayTransactions = transactions.filter(t => t.date === date);
    const income = dayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = dayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    return {
      date: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      Receitas: income,
      Despesas: expense
    };
  });

  return (
    <div className="charts-grid">
      <div className="chart-container">
        <h3>Despesas por Categoria</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
            <XAxis dataKey="name" stroke="currentColor" />
            <YAxis stroke="currentColor" />
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}
              formatter={(value: number) => `R$ ${value.toFixed(2)}`}
            />
            <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-container">
        <h3>Distribuição de Gastos</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {categoryData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-container full-width">
        <h3>Últimos 7 Dias - Receitas vs Despesas</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={lineChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
            <XAxis dataKey="date" stroke="currentColor" />
            <YAxis stroke="currentColor" />
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}
              formatter={(value: number) => `R$ ${value.toFixed(2)}`}
            />
            <Legend />
            <Line type="monotone" dataKey="Receitas" stroke="#10b981" strokeWidth={2} />
            <Line type="monotone" dataKey="Despesas" stroke="#ef4444" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/**
 * Transaction List Component
 */
const TransactionList: React.FC<{
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
}> = ({ transactions, onEdit, onDelete }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (transactions.length === 0) {
    return (
      <div className="empty-state">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <p>Nenhuma transação encontrada</p>
      </div>
    );
  }

  return (
    <div className="transaction-list">
      <h3>Transações ({transactions.length})</h3>
      <div className="transactions">
        {transactions.map(transaction => (
          <div key={transaction.id} className={`transaction-item ${transaction.type}`}>
            <div className="transaction-info">
              <div className="transaction-header">
                <h4>{transaction.description}</h4>
                <span className={`transaction-type ${transaction.type}`}>
                  {transaction.type === 'income' ? 'Receita' : 'Despesa'}
                </span>
              </div>
              <div className="transaction-details">
                <span className="category">{transaction.category}</span>
                <span className="date">{formatDate(transaction.date)}</span>
              </div>
            </div>
            <div className="transaction-actions">
              <span className={`amount ${transaction.type}`}>
                {transaction.type === 'income' ? '+' : '-'} {formatCurrency(transaction.amount)}
              </span>
              <div className="action-buttons">
                <button onClick={() => onEdit(transaction)} className="btn-edit" aria-label="Editar">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button onClick={() => onDelete(transaction.id)} className="btn-delete" aria-label="Excluir">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

const App: React.FC = () => {
  // Initialize dark mode from storage
  const [darkMode, setDarkMode] = useState(() => {
    return StorageService.loadFromStorage(StorageService.getKeys().DARK_MODE, false);
  });

  // Initialize controller with model loaded from storage
  const [controller] = useState(() => {
    const model = TransactionModel.loadFromStorage();
    return new TransactionController(model);
  });

  // State management - CORRIGIDO: usar contador numérico
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Subscribe to controller changes - CORRIGIDO: usar setUpdateTrigger
  useEffect(() => {
    const unsubscribe = controller.subscribe(() => {
      setUpdateTrigger(prev => prev + 1);
    });
    return unsubscribe;
  }, [controller]);

  // Update dark mode in DOM and storage
  useEffect(() => {
    if (isClient) {
      document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
      StorageService.saveToStorage(StorageService.getKeys().DARK_MODE, darkMode);
    }
  }, [darkMode]);

  // Compute filtered transactions - CORRIGIDO: adicionar updateTrigger às dependências
  const filteredTransactions = useMemo(() => {
    let transactions = controller.getTransactions();

    // Apply period filter
    transactions = controller.filterByPeriod(period);

    // Apply search filter
    if (searchTerm) {
      transactions = controller.searchTransactions(searchTerm)
        .filter(t => transactions.some(ft => ft.id === t.id));
    }

    // Sort by date (most recent first)
    return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [controller, period, searchTerm, updateTrigger]);

  // Compute summary and category data - CORRIGIDO: adicionar updateTrigger
  const summary = useMemo(() =>
    controller.getSummary(filteredTransactions),
    [controller, filteredTransactions, updateTrigger]
  );

  const categoryData = useMemo(() =>
    controller.getCategoryData(filteredTransactions),
    [controller, filteredTransactions, updateTrigger]
  );

  // Handlers
  const toggleTheme = () => setDarkMode(!darkMode);

  const handleAddTransaction = (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
    if (editingTransaction) {
      controller.updateTransaction(editingTransaction.id, transaction);
      setEditingTransaction(null);
    } else {
      controller.addTransaction(transaction);
    }
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteTransaction = (id: string) => {
    if (confirm('Deseja realmente excluir esta transação?')) {
      controller.deleteTransaction(id);
      if (editingTransaction?.id === id) {
        setEditingTransaction(null);
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingTransaction(null);
  };

  return (
    <div className="app">
      <Header darkMode={darkMode} toggleTheme={toggleTheme} />

      <main className="main-content">
        <div className="container">
          <SummaryCards summary={summary} />

          <div className="content-grid">
            <div className="form-section">
              <TransactionForm
                onSubmit={handleAddTransaction}
                editingTransaction={editingTransaction}
                onCancelEdit={handleCancelEdit}
              />
            </div>

            <div className="data-section">
              <Filters
                period={period}
                onPeriodChange={setPeriod}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
              />

              {categoryData.length > 0 && (
                <Charts categoryData={categoryData} transactions={filteredTransactions} />
              )}

              <TransactionList
                transactions={filteredTransactions}
                onEdit={handleEditTransaction}
                onDelete={handleDeleteTransaction}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const APP_STYLES = `
:root {
  --primary: #8b5cf6;
  --primary-dark: #7c3aed;
  --success: #10b981;
  --danger: #ef4444;
  --warning: #f59e0b;
  --info: #3b82f6;
  
  --bg: #f8fafc;
  --surface: #ffffff;
  --card-bg: #ffffff;
  --text: #1e293b;
  --text-secondary: #64748b;
  --border: #e2e8f0;
  --shadow: rgba(0, 0, 0, 0.1);
  
  --header-bg: #ffffff;
  --header-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

[data-theme="dark"] {
  --bg: #0f172a;
  --surface: #1e293b;
  --card-bg: #1e293b;
  --text: #f1f5f9;
  --text-secondary: #94a3b8;
  --border: #334155;
  --shadow: rgba(0, 0, 0, 0.3);
  
  --header-bg: #1e293b;
  --header-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: var(--bg);
  color: var(--text);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Header Styles */
.header {
  background: var(--header-bg);
  box-shadow: var(--header-shadow);
  position: sticky;
  top: 0;
  z-index: 100;
  transition: background-color 0.3s ease;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-icon {
  width: 32px;
  height: 32px;
  color: var(--primary);
}

.header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text);
}

.theme-toggle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px var(--shadow);
}

.theme-toggle:hover {
  transform: scale(1.05);
  background: var(--primary);
  color: white;
}

.theme-toggle svg {
  width: 20px;
  height: 20px;
}

/* Main Content */
.main-content {
  flex: 1;
  padding: 2rem 0;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 2rem;
}

/* Summary Cards */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.summary-card {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px var(--shadow);
  transition: all 0.3s ease;
  border: 1px solid var(--border);
}

.summary-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 12px var(--shadow);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.card-header h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.card-header svg {
  width: 24px;
  height: 24px;
  opacity: 0.6;
}

.card-value {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.card-value-text {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary);
}

.card-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.summary-card.balance .card-value {
  color: var(--primary);
}

.summary-card.income .card-value {
  color: var(--success);
}

.summary-card.expense .card-value {
  color: var(--danger);
}

.summary-card.highlight .card-value {
  color: var(--warning);
}

/* Content Grid */
.content-grid {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 2rem;
  align-items: start;
}

@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

/* Transaction Form */
.transaction-form {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px var(--shadow);
  border: 1px solid var(--border);
  position: sticky;
  top: 100px;
}

.transaction-form h2 {
  margin-bottom: 1.5rem;
  color: var(--text);
  font-size: 1.25rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: var(--text);
  font-size: 0.875rem;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 1rem;
  transition: all 0.2s ease;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.btn-primary,
.btn-secondary {
  flex: 1;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 1rem;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
}

.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--border);
}

/* Filters */
.filters {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.search-box {
  position: relative;
  flex: 1;
}

.search-box svg {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  color: var(--text-secondary);
}

.search-box input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 3rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card-bg);
  color: var(--text);
  font-size: 1rem;
  transition: all 0.2s ease;
}

.search-box input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.period-filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card-bg);
  color: var(--text);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-btn:hover {
  background: var(--surface);
  border-color: var(--primary);
}

.filter-btn.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

/* Charts */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.chart-container {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px var(--shadow);
  border: 1px solid var(--border);
}

.chart-container.full-width {
  grid-column: 1 / -1;
}

.chart-container h3 {
  margin-bottom: 1rem;
  color: var(--text);
  font-size: 1.125rem;
}

@media (max-width: 768px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
}

/* Transaction List */
.transaction-list {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px var(--shadow);
  border: 1px solid var(--border);
}

.transaction-list h3 {
  margin-bottom: 1.5rem;
  color: var(--text);
  font-size: 1.125rem;
}

.transactions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.transaction-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  background: var(--surface);
  border-radius: 10px;
  border: 1px solid var(--border);
  transition: all 0.2s ease;
}

.transaction-item:hover {
  transform: translateX(4px);
  box-shadow: 0 2px 8px var(--shadow);
}

.transaction-item.income {
  border-left: 4px solid var(--success);
}

.transaction-item.expense {
  border-left: 4px solid var(--danger);
}

.transaction-info {
  flex: 1;
}

.transaction-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.transaction-header h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
}

.transaction-type {
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.transaction-type.income {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success);
}

.transaction-type.expense {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}

.transaction-details {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.category {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.category::before {
  content: '•';
  font-weight: bold;
}

.transaction-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.amount {
  font-size: 1.125rem;
  font-weight: 700;
  min-width: 120px;
  text-align: right;
}

.amount.income {
  color: var(--success);
}

.amount.expense {
  color: var(--danger);
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-edit,
.btn-delete {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.btn-edit {
  background: rgba(59, 130, 246, 0.1);
  color: var(--info);
}

.btn-edit:hover {
  background: var(--info);
  color: white;
  transform: scale(1.1);
}

.btn-delete {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}

.btn-delete:hover {
  background: var(--danger);
  color: white;
  transform: scale(1.1);
}

.btn-edit svg,
.btn-delete svg {
  width: 18px;
  height: 18px;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-secondary);
}

.empty-state svg {
  width: 64px;
  height: 64px;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state p {
  font-size: 1.125rem;
}

/* Responsive Design */
@media (max-width: 768px) {
  .container {
    padding: 0 1rem;
  }
  
  .header-content {
    padding: 1rem;
  }
  
  .header h1 {
    font-size: 1.25rem;
  }
  
  .summary-grid {
    grid-template-columns: 1fr;
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .transaction-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .transaction-actions {
    width: 100%;
    justify-content: space-between;
  }
  
  .amount {
    text-align: left;
  }
  
  .period-filters {
    justify-content: center;
  }
}

/* Print Styles */
@media print {
  .header,
  .theme-toggle,
  .transaction-form,
  .filters,
  .action-buttons {
    display: none;
  }
  
  .content-grid {
    grid-template-columns: 1fr;
  }
  
  .chart-container,
  .transaction-list {
    break-inside: avoid;
  }
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.transaction-item,
.summary-card,
.chart-container {
  animation: fadeIn 0.3s ease-out;
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 10px;
}

::-webkit-scrollbar-track {
  background: var(--bg);
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
`;

// ============================================================================
// SSR SETUP & EXPORT
// ============================================================================

// Inject styles into document
if (isClient) {
  const styleId = 'app-styles';
  let styleElement = document.getElementById(styleId);
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = APP_STYLES;
    document.head.appendChild(styleElement);
  }
}

export default App;
