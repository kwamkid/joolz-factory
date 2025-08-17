// src/app/(protected)/bottles/[id]/stock/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { 
  doc, getDoc, updateDoc, collection, addDoc, 
  query, where, orderBy, limit, getDocs 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  ArrowLeft, Package, Plus, Minus, RefreshCw, 
  AlertTriangle, History, Loader2, TrendingUp, 
  TrendingDown, Calendar, User
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BottleType, BottleStockMovement } from '@/types/bottle';

type MovementType = 'in' | 'out' | 'adjust';

export default function BottleStockPage() {
  const router = useRouter();
  const params = useParams();
  const { user: currentUser } = useAuth();
  const bottleId = params.id as string;

  const [bottle, setBottle] = useState<BottleType | null>(null);
  const [movements, setMovements] = useState<BottleStockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  // Form State
  const [movementType, setMovementType] = useState<MovementType>('in');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [reference, setReference] = useState('');

  // Check permission
  useEffect(() => {
    if (currentUser && currentUser.role === 'operation') {
      toast.error('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  // Fetch data
  useEffect(() => {
    fetchBottleData();
    fetchMovements();
  }, [bottleId]);

  const fetchBottleData = async () => {
    try {
      const bottleDoc = await getDoc(doc(db, 'bottles', bottleId));
      
      if (!bottleDoc.exists()) {
        toast.error('ไม่พบข้อมูลขวด');
        router.push('/bottles');
        return;
      }

      setBottle({ id: bottleDoc.id, ...bottleDoc.data() } as BottleType);
    } catch (error) {
      console.error('Error fetching bottle:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async () => {
    try {
      const movementsQuery = query(
        collection(db, 'bottle_movements'),
        where('bottleTypeId', '==', bottleId),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      
      const movementsSnapshot = await getDocs(movementsQuery);
      const movementsData: BottleStockMovement[] = [];
      
      movementsSnapshot.forEach((doc) => {
        const data = doc.data();
        movementsData.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        } as BottleStockMovement);
      });
      
      setMovements(movementsData);
    } catch (error) {
      console.error('Error fetching movements:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!bottle) return;
    
    const qty = Number(quantity);
    if (qty <= 0) {
      toast.error('จำนวนต้องมากกว่า 0');
      return;
    }

    // Validate stock out
    if (movementType === 'out' && qty > bottle.currentStock) {
      toast.error('จำนวนที่จะเบิกมากกว่าสต็อกคงเหลือ');
      return;
    }

    setSubmitting(true);

    try {
      const previousStock = bottle.currentStock;
      let newStock = previousStock;

      // Calculate new stock
      switch (movementType) {
        case 'in':
          newStock = previousStock + qty;
          break;
        case 'out':
          newStock = previousStock - qty;
          break;
        case 'adjust':
          newStock = qty;
          break;
      }

      // Create movement record
      const movement: Omit<BottleStockMovement, 'id'> = {
        bottleTypeId: bottleId,
        bottleTypeName: bottle.name,
        movementType,
        quantity: qty,
        previousStock,
        newStock,
        reference: reference.trim(),
        notes: notes.trim(),
        createdAt: new Date(),
        createdBy: currentUser?.uid || '',
        createdByName: currentUser?.name || ''
      };

      // Add movement record
      await addDoc(collection(db, 'bottle_movements'), movement);

      // Update bottle stock
      await updateDoc(doc(db, 'bottles', bottleId), {
        currentStock: newStock,
        updatedAt: new Date(),
        updatedBy: currentUser?.uid
      });

      toast.success('อัพเดทสต็อกสำเร็จ');
      
      // Reset form
      setQuantity('');
      setNotes('');
      setReference('');
      
      // Refresh data
      fetchBottleData();
      fetchMovements();
    } catch (error) {
      console.error('Error updating stock:', error);
      toast.error('เกิดข้อผิดพลาดในการอัพเดทสต็อก');
    } finally {
      setSubmitting(false);
    }
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'in':
        return <Plus className="h-4 w-4 text-green-400" />;
      case 'out':
        return <Minus className="h-4 w-4 text-red-400" />;
      case 'adjust':
        return <RefreshCw className="h-4 w-4 text-blue-400" />;
      default:
        return <Package className="h-4 w-4 text-gray-400" />;
    }
  };

  const getMovementLabel = (type: string) => {
    switch (type) {
      case 'in': return 'รับเข้า';
      case 'out': return 'เบิกออก';
      case 'adjust': return 'ปรับยอด';
      case 'production': return 'ผลิต';
      case 'damaged': return 'เสียหาย';
      default: return type;
    }
  };

  const getStockStatus = () => {
    if (!bottle) return null;
    
    const percentage = bottle.minStockLevel ? (bottle.currentStock / bottle.minStockLevel) * 100 : 100;
    
    if (percentage <= 25) {
      return { color: 'text-red-400', bg: 'bg-red-900/20', label: 'วิกฤต' };
    } else if (percentage <= 50) {
      return { color: 'text-yellow-400', bg: 'bg-yellow-900/20', label: 'ต่ำ' };
    } else {
      return { color: 'text-green-400', bg: 'bg-green-900/20', label: 'ปกติ' };
    }
  };

  if (loading) {
    return (
      <div className="page-content">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
            <p className="mt-4 text-gray-400">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!bottle) {
    return null;
  }

  const stockStatus = getStockStatus();

  return (
    <div className="page-content">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/bottles')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับ
        </button>
        
        <div className="flex items-center gap-4">
          {bottle.imageUrl ? (
            <img src={bottle.imageUrl} alt={bottle.name} className="h-16 w-16 object-contain" />
          ) : (
            <Package className="h-16 w-16 text-gray-600" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">{bottle.name}</h1>
            <p className="text-gray-400">จัดการสต็อกขวด</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock Info */}
        <div className="lg:col-span-1">
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">ข้อมูลสต็อก</h3>
            
            {/* Current Stock */}
            <div className={`p-4 rounded-lg ${stockStatus?.bg} mb-4`}>
              <p className="text-sm text-gray-400 mb-1">คงเหลือปัจจุบัน</p>
              <p className={`text-3xl font-bold ${stockStatus?.color}`}>
                {bottle.currentStock.toLocaleString()}
              </p>
              <p className={`text-sm ${stockStatus?.color} mt-1`}>
                สถานะ: {stockStatus?.label}
              </p>
            </div>

            {/* Stock Details */}
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">จำนวนขั้นต่ำ:</span>
                <span className="text-white">{(bottle.minStockLevel || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">ขนาด:</span>
                <span className="text-white">{bottle.sizeInMl} ml</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">ราคาต่อขวด:</span>
                <span className="text-white">฿{bottle.pricePerUnit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">มูลค่าคงเหลือ:</span>
                <span className="text-primary font-semibold">
                  ฿{(bottle.currentStock * bottle.pricePerUnit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Stock Bar */}
            <div className="mt-4">
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all ${
                    stockStatus?.label === 'วิกฤต' ? 'bg-red-500' :
                    stockStatus?.label === 'ต่ำ' ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ 
                    width: `${Math.min(100, bottle.minStockLevel ? (bottle.currentStock / bottle.minStockLevel) * 100 : 0)}%` 
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stock Form */}
        <div className="lg:col-span-2">
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">บันทึกการเคลื่อนไหว</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Movement Type */}
              <div>
                <label className="label">ประเภท</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMovementType('in')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      movementType === 'in'
                        ? 'border-green-500 bg-green-900/20 text-green-400'
                        : 'border-gray-700 hover:border-gray-600 text-gray-400'
                    }`}
                  >
                    <TrendingUp className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm">รับเข้า</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setMovementType('out')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      movementType === 'out'
                        ? 'border-red-500 bg-red-900/20 text-red-400'
                        : 'border-gray-700 hover:border-gray-600 text-gray-400'
                    }`}
                  >
                    <TrendingDown className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm">เบิกออก</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setMovementType('adjust')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      movementType === 'adjust'
                        ? 'border-blue-500 bg-blue-900/20 text-blue-400'
                        : 'border-gray-700 hover:border-gray-600 text-gray-400'
                    }`}
                  >
                    <RefreshCw className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-sm">ปรับยอด</span>
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="label">
                  {movementType === 'adjust' ? 'ปรับยอดเป็น' : 'จำนวน'} *
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="input"
                  placeholder="0"
                  required
                />
                {movementType === 'out' && Number(quantity) > bottle.currentStock && (
                  <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    จำนวนมากกว่าสต็อกคงเหลือ
                  </p>
                )}
              </div>

              {/* Reference */}
              <div>
                <label className="label">เลขที่อ้างอิง</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="input"
                  placeholder="PO-2024-001"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="label">หมายเหตุ</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input min-h-[80px]"
                  placeholder="รายละเอียดเพิ่มเติม..."
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || !quantity}
                className="btn btn-primary w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  'บันทึกรายการ'
                )}
              </button>
            </form>
          </div>

          {/* Recent Movements */}
          <div className="card mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">ประวัติการเคลื่อนไหว</h3>
              <button
                onClick={() => router.push(`/bottles/${bottleId}/history`)}
                className="text-sm text-primary hover:text-primary-light transition-colors"
              >
                ดูทั้งหมด
              </button>
            </div>

            {movements.length > 0 ? (
              <div className="space-y-3">
                {movements.map((movement) => (
                  <div key={movement.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getMovementIcon(movement.movementType)}
                      <div>
                        <p className="text-sm text-white font-medium">
                          {getMovementLabel(movement.movementType)} {movement.quantity.toLocaleString()} ขวด
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {movement.createdByName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(movement.createdAt).toLocaleDateString('th-TH')}
                          </span>
                        </div>
                        {movement.notes && (
                          <p className="text-xs text-gray-500 mt-1">{movement.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">
                        {movement.previousStock} → {movement.newStock}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <History className="h-12 w-12 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400">ยังไม่มีประวัติการเคลื่อนไหว</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}