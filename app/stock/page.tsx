// Path: app/stock/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import {
  Package,
  TrendingUp,
  Factory,
  AlertTriangle,
  AlertCircle,
  Check,
  X,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  History,
  Filter
} from 'lucide-react';
import { getImageUrl } from '@/lib/utils/image';

// Raw Material with last transaction and average prices
interface RawMaterial {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
  image?: string;
  last_transaction?: {
    type: 'in' | 'production' | 'damage';
    quantity: number;
    date: string;
  };
  avg_price_30d?: number;
  avg_price_3m?: number;
  avg_price_1y?: number;
}

// Transaction interface
interface StockTransaction {
  id: string;
  raw_material_id: string;
  transaction_type: 'in' | 'production' | 'damage';
  quantity: number;
  unit_price?: number;
  total_price?: number;
  notes?: string;
  created_at: string;
  raw_materials?: {
    name: string;
    unit: string;
  };
}

// Transaction type
type TransactionType = 'in' | 'production' | 'damage' | null;

export default function StockManagementPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'stock' | 'history'>('stock');

  // Form state
  const [transactionType, setTransactionType] = useState<TransactionType>(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState(''); // ราคาต่อหน่วย
  const [totalPrice, setTotalPrice] = useState(''); // ราคารวม
  const [notes, setNotes] = useState('');

  // Filter state for history
  const [filterType, setFilterType] = useState<'all' | 'in' | 'production' | 'damage'>('all');
  const [filterMaterialId, setFilterMaterialId] = useState<string>('all');

  // Fetch materials with last transaction and average prices
  const fetchMaterials = useCallback(async () => {
    try {
      setLoading(true);

      // Get session for API calls
      const { data: sessionData } = await supabase.auth.getSession();
      const authHeaders = {
        'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
      };

      // Fetch raw materials via API
      const materialsResponse = await fetch('/api/raw-materials', {
        method: 'GET',
        headers: authHeaders
      });

      const materialsResult = await materialsResponse.json();

      if (!materialsResponse.ok) {
        throw new Error(materialsResult.error || 'Failed to fetch raw materials');
      }

      const materialsData = materialsResult.materials || [];

      // Sort by stock descending
      materialsData.sort((a: RawMaterial, b: RawMaterial) => b.current_stock - a.current_stock);

      // Fetch all transactions to calculate averages (limit to recent ones)
      const transactionsResponse = await fetch('/api/stock-transactions', {
        method: 'GET',
        headers: authHeaders
      });

      const transactionsResult = await transactionsResponse.json();
      const allTransactions = transactionsResult.transactions || [];

      // Calculate date ranges
      const now = new Date();
      const date30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const date3m = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const date1y = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      // Calculate weighted average prices
      const calculateAvgPrice = (transactions: any[]) => {
        if (!transactions || transactions.length === 0) return undefined;
        const totalValue = transactions.reduce((sum, tx) => sum + (tx.unit_price * tx.quantity), 0);
        const totalQty = transactions.reduce((sum, tx) => sum + tx.quantity, 0);
        return totalQty > 0 ? totalValue / totalQty : undefined;
      };

      // Process each material with transaction data
      const materialsWithDetails = materialsData.map((material: RawMaterial) => {
        // Filter transactions for this material
        const materialTxs = allTransactions.filter(
          (tx: StockTransaction) => tx.raw_material_id === material.id
        );

        // Get last transaction
        const lastTx = materialTxs.length > 0 ? materialTxs[0] : null; // Already sorted by created_at desc

        // Filter 'in' transactions with valid prices
        const inTransactions = materialTxs.filter(
          (tx: StockTransaction) =>
            tx.transaction_type === 'in' &&
            tx.unit_price &&
            tx.unit_price > 0
        );

        // Calculate average prices for different periods
        const tx30d = inTransactions.filter(
          (tx: StockTransaction) => new Date(tx.created_at) >= date30d
        );
        const tx3m = inTransactions.filter(
          (tx: StockTransaction) => new Date(tx.created_at) >= date3m
        );
        const tx1y = inTransactions.filter(
          (tx: StockTransaction) => new Date(tx.created_at) >= date1y
        );

        return {
          ...material,
          last_transaction: lastTx ? {
            type: lastTx.transaction_type as 'in' | 'production' | 'damage',
            quantity: lastTx.quantity,
            date: lastTx.created_at
          } : undefined,
          avg_price_30d: calculateAvgPrice(tx30d),
          avg_price_3m: calculateAvgPrice(tx3m),
          avg_price_1y: calculateAvgPrice(tx1y)
        };
      });

      setMaterials(materialsWithDetails);
    } catch (error) {
      console.error('Error fetching materials:', error);
      setError('ไม่สามารถโหลดข้อมูลวัตถุดิบได้');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    try {
      setLoadingTransactions(true);
      const { data: sessionData } = await supabase.auth.getSession();

      const response = await fetch('/api/stock-transactions', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
        }
      });

      const result = await response.json();

      if (response.ok && result.transactions) {
        setTransactions(result.transactions);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoadingTransactions(false);
    }
  }, []);

  // Check auth
  useEffect(() => {
    if (authLoading) return;

    if (!userProfile) {
      router.push('/login');
      return;
    }
  }, [userProfile, authLoading, router]);

  // Fetch materials and transactions
  useEffect(() => {
    if (!authLoading && userProfile) {
      fetchMaterials();
      fetchTransactions();
    }
  }, [authLoading, userProfile, fetchMaterials, fetchTransactions]);

  // Auto-calculate unit price when quantity or total price changes
  useEffect(() => {
    if (transactionType === 'in' && quantity && totalPrice) {
      const quantityNum = parseFloat(quantity);
      const totalPriceNum = parseFloat(totalPrice);
      if (!isNaN(quantityNum) && !isNaN(totalPriceNum) && quantityNum > 0) {
        setUnitPrice((totalPriceNum / quantityNum).toFixed(2));
      }
    }
  }, [quantity, totalPrice, transactionType]);

  // Handle submit transaction
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    // Validation
    if (!selectedMaterialId) {
      setError('กรุณาเลือกวัตถุดิบ');
      setSaving(false);
      return;
    }

    const quantityNum = parseFloat(quantity);
    if (!quantity || quantityNum <= 0) {
      setError('กรุณากรอกจำนวนที่ถูกต้อง');
      setSaving(false);
      return;
    }

    // Validate price for 'in' transaction
    if (transactionType === 'in') {
      const totalPriceNum = parseFloat(totalPrice);
      if (!totalPrice || totalPriceNum <= 0) {
        setError('กรุณากรอกราคารวมสำหรับการซื้อเข้า');
        setSaving(false);
        return;
      }
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      const response = await fetch('/api/stock-transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData?.session?.access_token || ''}`
        },
        body: JSON.stringify({
          raw_material_id: selectedMaterialId,
          transaction_type: transactionType,
          quantity: quantityNum,
          unit_price: transactionType === 'in' ? parseFloat(unitPrice) : undefined,
          total_price: transactionType === 'in' ? parseFloat(totalPrice) : undefined,
          notes: notes || undefined
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'ไม่สามารถบันทึกรายการได้');
      }

      let successMsg = '';
      if (transactionType === 'in') {
        successMsg = `บันทึกการซื้อเข้าสำเร็จ สต็อกใหม่: ${result.new_stock}`;
      } else if (transactionType === 'production') {
        successMsg = `บันทึกการตัดผลิตสำเร็จ สต็อกใหม่: ${result.new_stock}`;
      } else {
        successMsg = `บันทึกการตัดของเสียสำเร็จ สต็อกใหม่: ${result.new_stock}`;
      }
      setSuccess(successMsg);

      // Reset form and close modal
      setShowModal(false);
      setTransactionType(null);
      setSelectedMaterialId('');
      setQuantity('');
      setUnitPrice('');
      setTotalPrice('');
      setNotes('');

      // Refresh materials and transactions
      fetchMaterials();
      fetchTransactions();
    } catch (error) {
      console.error('Error saving transaction:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    } finally {
      setSaving(false);
    }
  };

  // Clear alerts after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Get stock status
  const getStockStatus = (stock: number, minStock: number) => {
    if (stock === 0) {
      return { label: 'หมดสต็อก', color: 'text-red-600', bgColor: 'bg-red-100' };
    } else if (stock <= minStock) {
      return { label: 'ใกล้หมด', color: 'text-orange-600', bgColor: 'bg-orange-100' };
    } else if (stock <= minStock * 2) {
      return { label: 'ปกติ', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    } else {
      return { label: 'เพียงพอ', color: 'text-green-600', bgColor: 'bg-green-100' };
    }
  };

  // Get transaction badge
  const getTransactionBadge = (type: 'in' | 'production' | 'damage') => {
    switch (type) {
      case 'in':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <TrendingUp className="w-3 h-3 mr-1" />
            ซื้อเข้า
          </span>
        );
      case 'production':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Factory className="w-3 h-3 mr-1" />
            ตัดผลิต
          </span>
        );
      case 'damage':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            ตัดเสีย
          </span>
        );
    }
  };

  // Handle view history for specific material
  const handleViewHistory = (materialId: string) => {
    setActiveTab('history');
    setFilterMaterialId(materialId);
  };

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    if (filterType !== 'all' && tx.transaction_type !== filterType) return false;
    if (filterMaterialId !== 'all' && tx.raw_material_id !== filterMaterialId) return false;
    return true;
  });

  // Show loading while checking auth
  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-[#E9B308] animate-spin mx-auto mb-4" />
            <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Not authorized
  if (!userProfile) {
    return null;
  }

  const selectedMaterial = materials.find(m => m.id === selectedMaterialId);

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <ArrowUpDown className="w-8 h-8 text-[#E9B308]" />
            สต็อกวัตถุดิบ / ซื้อ-ออก
          </h1>
          <p className="text-gray-600 text-base">จัดการสต็อกวัตถุดิบและบันทึกรายการซื้อ-ออก</p>
        </div>

        <div className="mt-4 sm:mt-0 flex gap-2">
          <button
            onClick={() => {
              setTransactionType('in');
              setShowModal(true);
            }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            ซื้อเข้า
          </button>
          <button
            onClick={() => {
              setTransactionType('damage');
              setShowModal(true);
            }}
            className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            ตัดเสีย
          </button>
          <button
            onClick={() => {
              setTransactionType('production');
              setShowModal(true);
            }}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors flex items-center gap-2"
          >
            <Factory className="w-4 h-4" />
            ตัดผลิต
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button
            onClick={() => setError('')}
            className="text-red-500 hover:text-red-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-3">
          <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-green-700">{success}</p>
          </div>
          <button
            onClick={() => setSuccess('')}
            className="text-green-500 hover:text-green-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('stock')}
          className={`px-6 py-3 font-medium transition-colors relative ${
            activeTab === 'stock'
              ? 'text-[#E9B308] border-b-2 border-[#E9B308]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4" />
            สต็อก
          </div>
        </button>
        <button
          onClick={() => {
            setActiveTab('history');
            setFilterMaterialId('all'); // Reset filter when switching tabs
          }}
          className={`px-6 py-3 font-medium transition-colors relative ${
            activeTab === 'history'
              ? 'text-[#E9B308] border-b-2 border-[#E9B308]'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4" />
            ประวัติรายการ
          </div>
        </button>
      </div>

      {/* Stock Cards */}
      {activeTab === 'stock' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {materials.map((material) => {
            const status = getStockStatus(material.current_stock, material.min_stock);
            return (
              <div
                key={material.id}
                className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col"
              >
                {/* Header with image and basic info */}
                <div className="flex items-start gap-4 mb-4">
                  {material.image ? (
                    <img
                      src={getImageUrl(material.image)}
                      alt={material.name}
                      className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{material.name}</h3>
                    <p className="text-sm text-gray-500">หน่วย: {material.unit}</p>
                  </div>
                </div>

                {/* Stock info */}
                <div className="space-y-3 mb-4 flex-grow">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">สต็อกปัจจุบัน</span>
                    <span className="text-lg font-bold text-gray-900">
                      {material.current_stock.toLocaleString()} {material.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">ขั้นต่ำ</span>
                    <span className="text-sm text-gray-500">{material.min_stock} {material.unit}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">สถานะ</span>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
                      {material.current_stock === 0 ? (
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                      ) : (
                        <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      )}
                      {status.label}
                    </span>
                  </div>

                  {/* Average Prices */}
                  {(material.avg_price_30d || material.avg_price_3m || material.avg_price_1y) && (
                    <div className="border-t border-gray-200 pt-3 mt-3">
                      <p className="text-xs font-medium text-gray-700 mb-2">ราคาเฉลี่ย (บาท/{material.unit})</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-blue-50 rounded px-2 py-1.5">
                          <p className="text-[10px] text-blue-600 font-medium mb-0.5">30 วัน</p>
                          <p className="text-xs font-bold text-blue-700">
                            {material.avg_price_30d ? `฿${material.avg_price_30d.toFixed(2)}` : '-'}
                          </p>
                        </div>
                        <div className="bg-green-50 rounded px-2 py-1.5">
                          <p className="text-[10px] text-green-600 font-medium mb-0.5">3 เดือน</p>
                          <p className="text-xs font-bold text-green-700">
                            {material.avg_price_3m ? `฿${material.avg_price_3m.toFixed(2)}` : '-'}
                          </p>
                        </div>
                        <div className="bg-purple-50 rounded px-2 py-1.5">
                          <p className="text-[10px] text-purple-600 font-medium mb-0.5">1 ปี</p>
                          <p className="text-xs font-bold text-purple-700">
                            {material.avg_price_1y ? `฿${material.avg_price_1y.toFixed(2)}` : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Last transaction */}
                  {material.last_transaction && (
                    <div className="border-t border-gray-200 pt-3 mt-3">
                      <p className="text-xs text-gray-500 mb-2">การกระทำล่าสุด</p>
                      <div className="flex items-center justify-between mb-1">
                        {getTransactionBadge(material.last_transaction.type)}
                        <span className="text-sm font-medium text-gray-900">
                          {material.last_transaction.type === 'in' ? '+' : '-'}
                          {material.last_transaction.quantity} {material.unit}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(material.last_transaction.date).toLocaleString('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action button - sticks to bottom */}
                <button
                  onClick={() => handleViewHistory(material.id)}
                  className="w-full mt-3 px-4 py-2 bg-[#E9B308]/10 text-[#E9B308] hover:bg-[#E9B308]/20 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <History className="w-4 h-4" />
                  ดูประวัติ
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* History Table */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-lg shadow p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-gray-500" />
              <h3 className="font-medium text-gray-700">ตัวกรอง</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ประเภทรายการ
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                >
                  <option value="all">ทั้งหมด</option>
                  <option value="in">ซื้อเข้า</option>
                  <option value="production">ตัดผลิต</option>
                  <option value="damage">ตัดเสีย</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  วัตถุดิบ
                </label>
                <select
                  value={filterMaterialId}
                  onChange={(e) => setFilterMaterialId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308]"
                >
                  <option value="all">ทั้งหมด</option>
                  {materials.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white border border-gray-200 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              {loadingTransactions ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-[#E9B308] animate-spin" />
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">ไม่พบรายการที่ค้นหา</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        วันที่/เวลา
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ประเภท
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        วัตถุดิบ
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        จำนวน
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ราคาต่อหน่วย
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ราคารวม
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        หมายเหตุ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredTransactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(transaction.created_at).toLocaleString('th-TH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getTransactionBadge(transaction.transaction_type)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8">
                              <div className="h-8 w-8 rounded bg-[#E9B308]/20 flex items-center justify-center">
                                <Package className="w-4 h-4 text-[#E9B308]" />
                              </div>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900">
                                {transaction.raw_materials?.name || '-'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${
                            transaction.transaction_type === 'in' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.transaction_type === 'in' ? '+' : '-'}
                            {transaction.quantity.toLocaleString('th-TH')} {transaction.raw_materials?.unit || ''}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {transaction.transaction_type === 'in' && transaction.unit_price
                            ? `฿${transaction.unit_price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {transaction.transaction_type === 'in' && transaction.total_price ? (
                            <span className="text-sm font-semibold text-[#E9B308]">
                              ฿{transaction.total_price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                          {transaction.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showModal && transactionType && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {transactionType === 'in' ? 'บันทึกการซื้อเข้า' :
                 transactionType === 'production' ? 'บันทึกการตัดผลิต (Manual)' : 'บันทึกการตัดของเสีย'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                type="button"
              >
                <X className="w-6 h-6" />
              </button>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="text-sm font-medium text-gray-700">
                    ประเภทรายการ: {' '}
                    <span className="font-semibold text-gray-900">
                      {transactionType === 'in' ? 'ซื้อเข้า' :
                       transactionType === 'production' ? 'ตัดผลิต' : 'ตัดของเสีย'}
                    </span>
                  </div>
                </div>

                {/* Material Selection - full list without scrollbar */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    เลือกวัตถุดิบ *
                  </label>
                  <div className="grid grid-cols-2 gap-3 border border-gray-300 rounded-lg p-3">
                    {materials.map((material) => (
                      <div
                        key={material.id}
                        onClick={() => setSelectedMaterialId(material.id)}
                        className={`cursor-pointer border-2 rounded-lg p-3 transition-all ${
                          selectedMaterialId === material.id
                            ? 'border-[#E9B308] bg-[#E9B308] bg-opacity-10'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {material.image ? (
                            <img
                              src={getImageUrl(material.image)}
                              alt={material.name}
                              className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Package className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">
                              {material.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              สต็อก: {material.current_stock} {material.unit}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {!selectedMaterialId && (
                    <p className="text-sm text-red-500 mt-1">กรุณาเลือกวัตถุดิบ</p>
                  )}
                </div>

                {/* Material Preview */}
                {selectedMaterial && (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0 h-12 w-12">
                        {selectedMaterial.image ? (
                          <img
                            src={getImageUrl(selectedMaterial.image)}
                            alt={selectedMaterial.name}
                            className="h-12 w-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-[#E9B308]/20 flex items-center justify-center">
                            <Package className="w-6 h-6 text-[#E9B308]" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {selectedMaterial.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          สต็อกปัจจุบัน: {selectedMaterial.current_stock} {selectedMaterial.unit}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    จำนวน {selectedMaterial ? `(${selectedMaterial.unit})` : ''} *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent text-base"
                    placeholder="0"
                    required
                  />
                </div>

                {/* Price fields - Only for 'in' transaction */}
                {transactionType === 'in' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ราคารวม (บาท) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={totalPrice}
                          onChange={(e) => setTotalPrice(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent text-base"
                          placeholder="500.00"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ราคาต่อหน่วย (บาท/{selectedMaterial?.unit || 'หน่วย'})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={unitPrice}
                          onChange={(e) => setUnitPrice(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent text-base font-semibold"
                          placeholder="คำนวณอัตโนมัติ"
                          readOnly
                        />
                      </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-700">
                        <strong>เช่น:</strong> ซื้อส้มสายน้ำผึ้งมา 20 kg ราคา 500 บาท → ระบบจะคำนวณให้ = 25 บาท/kg
                      </p>
                    </div>
                  </>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    หมายเหตุ (ถ้ามี)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E9B308] focus:border-transparent text-base"
                    placeholder="เช่น ซื้อจากซัพพลายเออร์ A, ใช้ผลิต Batch#123..."
                  />
                </div>

                {/* Submit Buttons */}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setTransactionType(null);
                      setSelectedMaterialId('');
                      setQuantity('');
                      setNotes('');
                    }}
                    className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center ${
                      transactionType === 'in'
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : transactionType === 'production'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {transactionType === 'in' ? 'บันทึกการซื้อเข้า' :
                     transactionType === 'production' ? 'บันทึกการตัดผลิต' : 'บันทึกการตัดของเสีย'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
