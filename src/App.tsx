import React, { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Search, Plus, Edit2, Trash2, Moon, Sun, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

// ==================== UTILS ====================
/**
 * Check if code is running on client-side
 */
const isClient = typeof window !== 'undefined';

// ==================== TYPES ====================
type TransactionType = 'income' | 'expense';

interface ITransaction {
  id: number;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: Date;
}

interface IFormData {
  type: TransactionType;
  amount: string;
  category: string;
  description: string;
  date: string;
}

interface ISummary {
  balance: number;
  highestExpense: ITransaction | null;
  dominantCategory: { category: string; total: number } | null;
  totalIncome: number;
  totalExpense: number;
}

interface ICategoryData {
  category: string;
  income: number;
  expense: number;
}

interface IPieData {
  name: string;
  value: number;
  [key: string]: string | number; // Index signature for Recharts compatibility
}

// ==================== MODEL ====================
// Transaction Model - Represents a financial transaction with business logic
class TransactionModel implements ITransaction {
  id: number;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: Date;

  constructor(id: number, type: TransactionType, amount: number | string, category: string, description: string, date: string | Date) {
    this.id = id;
    this.type = type;
    this.amount = typeof amount === 'string' ? parseFloat(amount) : amount;
    this.category = category;
    this.description = description;
    this.date = typeof date === 'string' ? new Date(date) : date;
  }

  // Check if transaction matches search term
  matchesSearch(searchTerm: string): boolean {
    const term = searchTerm.toLowerCase();
    return (
      this.description.toLowerCase().includes(term) ||
      this.category.toLowerCase().includes(term)
    );
  }

  // Check if transaction is within date range
  isInDateRange(startDate: Date, endDate: Date): boolean {
    return this.date >= startDate && this.date <= endDate;
  }

  // Format amount for display
  getFormattedAmount(): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(this.amount);
  }

  // Format date for display
  getFormattedDate(): string {
    return this.date.toLocaleDateString('pt-BR');
  }

  // Serialize for storage
  toJSON(): any {
    return {
      id: this.id,
      type: this.type,
      amount: this.amount,
      category: this.category,
      description: this.description,
      date: this.date.toISOString()
    };
  }

  // Deserialize from storage
  static fromJSON(json: any): TransactionModel {
    return new TransactionModel(
      json.id,
      json.type,
      json.amount,
      json.category,
      json.description,
      json.date
    );
  }
}

// ==================== SERVICE ====================
// Storage Service - Handles all sessionStorage operations with SSR support
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

// ==================== CONTROLLER ====================
// Financial Controller - Business logic and calculations
class FinancialController {
  // Calculate total balance
  static calculateBalance(transactions: TransactionModel[]): number {
    return transactions.reduce((acc, t) => {
      return t.type === 'income' ? acc + t.amount : acc - t.amount;
    }, 0);
  }

  // Get highest expense transaction
  static getHighestExpense(transactions: TransactionModel[]): TransactionModel | null {
    const expenses = transactions.filter(t => t.type === 'expense');
    if (expenses.length === 0) return null;
    return expenses.reduce((max, t) => t.amount > max.amount ? t : max);
  }

  // Get category with most spending
  static getDominantCategory(transactions: TransactionModel[]): { category: string; total: number } | null {
    const expenses = transactions.filter(t => t.type === 'expense');
    if (expenses.length === 0) return null;

    const categoryTotals = expenses.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(categoryTotals)
      .reduce((max, [cat, total]) =>
        total > max.total ? { category: cat, total } : max,
        { category: '', total: 0 }
      );
  }

  // Group transactions by category for charts
  static groupByCategory(transactions: TransactionModel[]): ICategoryData[] {
    const grouped = transactions.reduce((acc, t) => {
      if (!acc[t.category]) {
        acc[t.category] = { category: t.category, income: 0, expense: 0 };
      }
      if (t.type === 'income') {
        acc[t.category].income += t.amount;
      } else {
        acc[t.category].expense += t.amount;
      }
      return acc;
    }, {} as Record<string, ICategoryData>);

    return Object.values(grouped);
  }

  // Get date range based on filter
  static getDateRange(filter: string): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let start: Date;

    switch (filter) {
      case 'day':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        break;
      case 'week':
        const dayOfWeek = now.getDay();
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
        break;
      default:
        start = new Date(2000, 0, 1);
    }

    return { start, end };
  }

  // Filter transactions based on search and period
  static filterTransactions(
    transactions: TransactionModel[],
    searchTerm: string,
    periodFilter: string
  ): TransactionModel[] {
    let filtered = transactions;

    if (searchTerm) {
      filtered = filtered.filter(t => t.matchesSearch(searchTerm));
    }

    if (periodFilter !== 'all') {
      const { start, end } = this.getDateRange(periodFilter);
      filtered = filtered.filter(t => t.isInDateRange(start, end));
    }

    return filtered.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  // Calculate summary statistics
  static calculateSummary(transactions: TransactionModel[]): ISummary {
    const balance = this.calculateBalance(transactions);
    const highestExpense = this.getHighestExpense(transactions);
    const dominantCategory = this.getDominantCategory(transactions);
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return { balance, highestExpense, dominantCategory, totalIncome, totalExpense };
  }

  // Format currency
  static formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  // Save dark mode to storage
  static saveDarkMode(isDark: boolean): void {
    StorageService.saveToStorage(StorageService.getKeys().DARK_MODE, isDark);
  }

  // Load dark mode from storage
  static loadDarkMode(): boolean {
    return StorageService.loadFromStorage<boolean>(StorageService.getKeys().DARK_MODE, false);
  }

  // Save transactions to storage
  static saveTransactions(transactions: TransactionModel[]): void {
    StorageService.saveToStorage(
      StorageService.getKeys().TRANSACTIONS,
      transactions.map(t => t.toJSON())
    );
  }

  // Load transactions from storage
  static loadTransactions(): TransactionModel[] {
    const saved = StorageService.loadFromStorage<any[]>(StorageService.getKeys().TRANSACTIONS, []);
    if (saved.length > 0) {
      return saved.map(TransactionModel.fromJSON);
    }
    return this.getDefaultTransactions();
  }

  // Get default transactions
  private static getDefaultTransactions(): TransactionModel[] {
    return [
      new TransactionModel(1, 'income', 5000, 'Salário', 'Salário mensal', '2025-11-01'),
      new TransactionModel(2, 'expense', 1200, 'Moradia', 'Aluguel', '2025-11-05'),
      new TransactionModel(3, 'expense', 450, 'Alimentação', 'Supermercado', '2025-11-06'),
      new TransactionModel(4, 'expense', 200, 'Transporte', 'Combustível', '2025-11-04'),
      new TransactionModel(5, 'income', 800, 'Freelance', 'Projeto web', '2025-11-03'),
      new TransactionModel(6, 'expense', 150, 'Lazer', 'Cinema e jantar', '2025-11-02'),
    ];
  }
}

// ==================== VIEW ====================
// Main Dashboard View Component with SSR support
export default function FinanceDashboard() {
  // State management with SSR-safe initialization
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [transactions, setTransactions] = useState<TransactionModel[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [periodFilter, setPeriodFilter] = useState<string>('month');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<IFormData>({
    type: 'expense',
    amount: '',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  const categories: Record<TransactionType, string[]> = {
    income: ['Salário', 'Freelance', 'Investimentos', 'Outros'],
    expense: ['Moradia', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Educação', 'Outros']
  };

  // Hydration effect - load data only on client-side
  useEffect(() => {
    setIsDarkMode(FinancialController.loadDarkMode());
    setTransactions(FinancialController.loadTransactions());
    setIsHydrated(true);
  }, []);

  // Sync dark mode to sessionStorage (client-side only)
  useEffect(() => {
    if (!isHydrated) return;
    FinancialController.saveDarkMode(isDarkMode);
  }, [isDarkMode, isHydrated]);

  // Sync transactions to sessionStorage (client-side only)
  useEffect(() => {
    if (!isHydrated) return;
    FinancialController.saveTransactions(transactions);
  }, [transactions, isHydrated]);

  // Filter transactions using controller
  const filteredTransactions = useMemo(() => {
    return FinancialController.filterTransactions(transactions, searchTerm, periodFilter);
  }, [transactions, searchTerm, periodFilter]);

  // Calculate summary using controller
  const summary = useMemo<ISummary>(() => {
    return FinancialController.calculateSummary(filteredTransactions);
  }, [filteredTransactions]);

  // Prepare chart data
  const chartData = useMemo<ICategoryData[]>(() => {
    return FinancialController.groupByCategory(filteredTransactions);
  }, [filteredTransactions]);

  const pieData = useMemo<IPieData[]>(() => {
    const expenses = filteredTransactions.filter(t => t.type === 'expense');
    const grouped = expenses.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([name, value]) => ({ name, value }));
  }, [filteredTransactions]);

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];

  // Event handlers
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let updatedTransactions: TransactionModel[];

    if (editingId !== null) {
      updatedTransactions = transactions.map(t =>
        t.id === editingId
          ? new TransactionModel(t.id, formData.type, formData.amount, formData.category, formData.description, formData.date)
          : t
      );
    } else {
      const newId = Math.max(0, ...transactions.map(t => t.id)) + 1;
      updatedTransactions = [...transactions, new TransactionModel(
        newId, formData.type, formData.amount, formData.category, formData.description, formData.date
      )];
    }

    setTransactions(updatedTransactions);
    resetForm();
  };

  const handleEdit = (transaction: TransactionModel) => {
    setEditingId(transaction.id);
    setFormData({
      type: transaction.type,
      amount: transaction.amount.toString(),
      category: transaction.category,
      description: transaction.description,
      date: transaction.date.toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  const handleDelete = (id: number) => {
    if (!isClient) return;

    if (window.confirm('Tem certeza que deseja excluir esta transação?')) {
      const updatedTransactions = transactions.filter(t => t.id !== id);
      setTransactions(updatedTransactions);
    }
  };

  const handleClearData = () => {
    if (!isClient) return;

    if (window.confirm('Tem certeza que deseja limpar todos os dados? Esta ação não pode ser desfeita.')) {
      StorageService.clearStorage();
      setIsDarkMode(false);
      setTransactions([]);
    }
  };

  const handleToggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
  };

  const resetForm = () => {
    setFormData({
      type: 'expense',
      amount: '',
      category: '',
      description: '',
      date: new Date().toISOString().split('T')[0]
    });
    setEditingId(null);
    setShowModal(false);
  };

  // Render
  return (
    <>
      <style>{APP_STYLES}</style>

      <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'dark bg-gray-900' : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50'}`}>
        {/* Header */}
        <header className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white/80 backdrop-blur-lg'} border-b shadow-sm sticky top-0 z-50`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-blue-600' : 'bg-gradient-to-br from-blue-500 to-purple-600'}`}>
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Finanças Pessoais
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleClearData}
                  className={`px-3 py-2 text-sm rounded-lg transition-all ${isDarkMode ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  title="Limpar todos os dados"
                >
                  Limpar Dados
                </button>
                <button
                  onClick={handleToggleDarkMode}
                  className={`p-2 rounded-lg transition-all ${isDarkMode ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className={`summary-card ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 shadow-lg hover:shadow-xl`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Saldo Atual</span>
                <Wallet className={`w-5 h-5 ${summary.balance >= 0 ? 'text-green-500' : 'text-red-500'}`} />
              </div>
              <p className={`text-3xl font-bold ${summary.balance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {FinancialController.formatCurrency(summary.balance)}
              </p>
            </div>

            <div className={`summary-card ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 shadow-lg hover:shadow-xl`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Receitas</span>
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
              <p className={`text-3xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                {FinancialController.formatCurrency(summary.totalIncome)}
              </p>
            </div>

            <div className={`summary-card ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 shadow-lg hover:shadow-xl`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Despesas</span>
                <TrendingDown className="w-5 h-5 text-red-500" />
              </div>
              <p className={`text-3xl font-bold ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                {FinancialController.formatCurrency(summary.totalExpense)}
              </p>
            </div>

            <div className={`summary-card ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 shadow-lg hover:shadow-xl`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Maior Gasto</span>
                <TrendingDown className="w-5 h-5 text-orange-500" />
              </div>
              <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {summary.highestExpense ? FinancialController.formatCurrency(summary.highestExpense.amount) : 'N/A'}
              </p>
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                {summary.highestExpense?.category || '-'}
              </p>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 shadow-lg`}>
              <h2 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Gastos por Categoria
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => {
                      const pct = (percent ?? 0) * 100;
                      return `${name} ${pct.toFixed(0)}%`;
                    }}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => FinancialController.formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 shadow-lg`}>
              <h2 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Receitas vs Despesas
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                  <XAxis dataKey="category" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <Tooltip
                    formatter={(value: number) => FinancialController.formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      color: isDarkMode ? '#ffffff' : '#000000'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="income" fill="#3b82f6" name="Receitas" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="expense" fill="#ef4444" name="Despesas" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Filters and Actions */}
          <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 shadow-lg mb-8`}>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                <input
                  type="text"
                  placeholder="Buscar transações..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-200 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value)}
                  className={`px-4 py-2.5 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                >
                  <option value="all">Todos</option>
                  <option value="day">Hoje</option>
                  <option value="week">Semana</option>
                  <option value="month">Mês</option>
                  <option value="year">Ano</option>
                </select>
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  Nova Transação
                </button>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <th className={`px-4 py-3 text-left text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Data</th>
                    <th className={`px-4 py-3 text-left text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Descrição</th>
                    <th className={`px-4 py-3 text-left text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Categoria</th>
                    <th className={`px-4 py-3 text-left text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Tipo</th>
                    <th className={`px-4 py-3 text-right text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Valor</th>
                    <th className={`px-4 py-3 text-right text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className={`${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors`}>
                      <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        {transaction.getFormattedDate()}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {transaction.description}
                      </td>
                      <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        {transaction.category}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${transaction.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                          {transaction.type === 'income' ? 'Receita' : 'Despesa'}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-semibold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {transaction.getFormattedAmount()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(transaction)}
                            className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-600 text-blue-400' : 'hover:bg-blue-50 text-blue-600'
                              }`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(transaction.id)}
                            className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-600 text-red-400' : 'hover:bg-red-50 text-red-600'
                              }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredTransactions.length === 0 && (
                <div className="text-center py-12">
                  <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Nenhuma transação encontrada
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Modal */}
        {showModal && (
          <div className="modal-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`modal-content ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 w-full max-w-md shadow-2xl`}>
              <h2 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {editingId !== null ? 'Editar Transação' : 'Nova Transação'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Tipo
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as TransactionType, category: '' })}
                    className={`w-full px-4 py-2.5 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    required
                  >
                    <option value="expense">Despesa</option>
                    <option value="income">Receita</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Categoria
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    required
                  >
                    <option value="">Selecione...</option>
                    {categories[formData.type].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Valor
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Descrição
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Data
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className={`w-full px-4 py-2.5 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className={`flex-1 px-4 py-2.5 rounded-lg border ${isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      } transition-colors`}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all shadow-md"
                  >
                    {editingId !== null ? 'Atualizar' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const APP_STYLES = `
  /* Global Styles */
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 5px; }
  ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  .dark ::-webkit-scrollbar-thumb { background: #475569; }
  .dark ::-webkit-scrollbar-thumb:hover { background: #64748b; }
  * { transition-property: background-color, border-color, color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
  table { border-collapse: collapse; width: 100%; }
  tbody tr { border-bottom: 1px solid #e5e7eb; }
  .dark tbody tr { border-bottom: 1px solid #374151; }
  .recharts-tooltip-wrapper { outline: none; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  .modal-backdrop { animation: fadeIn 0.2s ease-out; }
  .modal-content { animation: scaleIn 0.3s ease-out; }
  .summary-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
  .summary-card:hover { transform: translateY(-4px); }
  input:focus, select:focus { outline: none; ring: 2px; ring-color: #3b82f6; }
  button:active { transform: scale(0.98); }
  html { scroll-behavior: smooth; }
`;
