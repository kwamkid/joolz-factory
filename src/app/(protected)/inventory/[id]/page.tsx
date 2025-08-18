// src/app/(protected)/inventory/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  ArrowLeft, Loader2, Package, Calendar, User, 
  FileText, Camera, Edit, TrendingDown, Clock,
  DollarSign, Star
} from 'lucide-react';
import toast from 'react-hot-toast';
import { InventoryBatch } from '@/types/inventory';

interface Movement {
  id: string;
  movementType: 'in' | 'out' | 'damage' | 'production';
  quantity: number;
  reference?: string;
  notes?: string;
  createdAt: Date;
  createdByName: string;
}

export default function InventoryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user: currentUser } = useAuth();
  const inventoryId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryBatch | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);

  useEffect(() => {
    fetchInventoryData();
  }, [inventoryId]);

  const fetchInventoryData = async () => {
    try {
      setLoading(true);
      
      // Fetch inventory data
      const inventoryDoc = await getDoc(doc(db, 'inventory_batches', inventoryId));
      
      if (!inventoryDoc.exists()) {
        toast.error('ไม่พบข้อมูลวัตถุดิบ');
        router.push('/inventory');
        return;
      }

      const data = inventoryDoc.data();
      const inventoryData: InventoryBatch = {
        id: inventoryDoc.id,
        ...data,
        purchaseDate: data.purchaseDate?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        finishedAt: data.finishedAt?.toDate(),
        expiryDate: data.expiryDate?.toDate()
      } as InventoryBatch;
      
      setInventory(inventoryData);

      // Fetch movements
      const movementsQuery = query(
        collection(db, 'inventory_movements'),
        where('batchId', '==', data.batchId),
        orderBy('createdAt', 'desc')
      );
      
      const movementsSnapshot = await getDocs(movementsQuery);
      const movementsData: Movement[] = [];
      
      movementsSnapshot.forEach((doc) => {
        const movData = doc.data();
        movementsData.push({
          id: doc.id,
          movementType: movData.movementType,
          quantity: movData.quantity,
          reference: movData.reference,
          notes: movData.notes,
          createdAt: movData.createdAt?.toDate() || new Date(),
          createdByName: movData.createdByName || 'ระบบ'
        });
      });
      
      setMovements(movementsData);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'in': return 'text-green-400';
      case 'out': return 'text-blue-400';
      case 'damage': return 'text-red-400';
      case 'production': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getMovementLabel = (type: string) => {
    switch (type) {
      case 'in': return 'ซื้อเข้า';
      case 'out': return 'เบิกใช้';
      case 'damage': return 'ของเสีย';
      case 'production': return 'ผลิต';
      default: return type;
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

  if (!inventory) {
    return null;
  }

  const usagePercentage = ((inventory.quantity - inventory.remainingQuantity) / inventory.quantity) * 100;

  return (
    <div className="page-content">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/inventory')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับ
        </button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">
              {inventory.materialType}
            </h1>
            <p className="text-gray-400">Batch ID: {inventory.batchId}</p>
          </div>
          
          {/* Edit Button */}
          {currentUser?.role !== 'operation' && !inventory.isFinished && (
            <button
              onClick={() => router.push(`/inventory/purchase/${inventory.id}`)}
              className="btn btn-secondary"
            >
              <Edit className="h-4 w-4" />
              แก้ไข
            </button>
          )}
        </div>
      </div>

      {/* Status Badge */}
      {inventory.isFinished && (
        <div className="mb-6 p-4 bg-gray-900 border border-gray-700 rounded-lg">
          <p className="text-gray-400 text-sm">
            ⚠️ วัตถุดิบนี้ถูกใช้หมดแล้วเมื่อ {inventory.finishedAt?.toLocaleDateString('th-TH')}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview Card */}
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">ข้อมูลทั่วไป</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-400">ซัพพลายเออร์</p>
                <p className="text-white font-medium">{inventory.supplier.name}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Star className="h-4 w-4 text-yellow-400 fill-current" />
                  <span className="text-sm text-gray-400">{inventory.supplier.rating.toFixed(1)}</span>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-gray-400">วันที่ซื้อ</p>
                <p className="text-white">{inventory.purchaseDate.toLocaleDateString('th-TH')}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-400">เลขที่ใบเสร็จ</p>
                <p className="text-white">{inventory.invoiceNumber || '-'}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-400">ผู้บันทึก</p>
                <p className="text-white">{inventory.createdByName}</p>
              </div>
            </div>

            {inventory.notes && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-sm text-gray-400 mb-1">หมายเหตุ</p>
                <p className="text-white">{inventory.notes}</p>
              </div>
            )}
          </div>

          {/* Quantity Card */}
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">จำนวนและมูลค่า</h2>
            
            <div className="space-y-4">
              {/* Quantity Progress */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">คงเหลือ</span>
                  <span className="text-white font-medium">
                    {inventory.remainingQuantity.toFixed(1)} / {inventory.quantity.toFixed(1)} kg
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all ${
                      inventory.remainingQuantity === 0 ? 'bg-gray-500' :
                      inventory.remainingQuantity < 10 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${100 - usagePercentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  ใช้ไปแล้ว {(inventory.quantity - inventory.remainingQuantity).toFixed(1)} kg ({usagePercentage.toFixed(0)}%)
                </p>
              </div>

              {/* Costs */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
                <div>
                  <p className="text-sm text-gray-400">ราคาต่อหน่วย</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(inventory.pricePerUnit)}/kg</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">มูลค่ารวม</p>
                  <p className="text-xl font-bold text-primary">{formatCurrency(inventory.totalCost)}</p>
                </div>
              </div>

              {/* Current Value */}
              {currentUser?.role !== 'operation' && (
                <div className="pt-4 border-t border-gray-700">
                  <p className="text-sm text-gray-400">มูลค่าคงเหลือ</p>
                  <p className="text-lg font-bold text-white">
                    {formatCurrency(inventory.remainingQuantity * inventory.pricePerUnit)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Movement History */}
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">ประวัติการเคลื่อนไหว</h2>
            
            {movements.length > 0 ? (
              <div className="space-y-3">
                {movements.map((movement) => (
                  <div key={movement.id} className="flex items-start gap-3 p-3 bg-gray-800 rounded-lg">
                    <TrendingDown className={`h-5 w-5 ${getMovementColor(movement.movementType)} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-white font-medium">
                          {getMovementLabel(movement.movementType)}
                        </p>
                        <p className={`font-medium ${movement.quantity > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {movement.quantity > 0 ? '+' : ''}{movement.quantity.toFixed(1)} kg
                        </p>
                      </div>
                      {movement.notes && (
                        <p className="text-sm text-gray-400 mt-1">{movement.notes}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {movement.createdByName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {movement.createdAt.toLocaleString('th-TH')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">ยังไม่มีการเคลื่อนไหว</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Invoice Image */}
          {inventory.invoiceUrl && (
            <div className="card">
              <h3 className="text-sm font-medium text-white mb-3">ใบเสร็จ</h3>
              <a 
                href={inventory.invoiceUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block"
              >
                <img 
                  src={inventory.invoiceUrl} 
                  alt="Invoice" 
                  className="w-full h-48 object-cover rounded-lg hover:opacity-80 transition-opacity"
                />
              </a>
            </div>
          )}

          {/* Quick Stats */}
          <div className="card">
            <h3 className="text-sm font-medium text-white mb-3">สถิติด่วน</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">อายุวัตถุดิบ</span>
                <span className="text-white text-sm">
                  {Math.floor((new Date().getTime() - inventory.purchaseDate.getTime()) / (1000 * 60 * 60 * 24))} วัน
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">อัตราการใช้</span>
                <span className="text-white text-sm">
                  {inventory.quantity - inventory.remainingQuantity > 0 
                    ? ((inventory.quantity - inventory.remainingQuantity) / Math.floor((new Date().getTime() - inventory.purchaseDate.getTime()) / (1000 * 60 * 60 * 24))).toFixed(2)
                    : '0'
                  } kg/วัน
                </span>
              </div>
              {inventory.remainingQuantity > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">คาดว่าจะหมด</span>
                  <span className="text-white text-sm">
                    ~{Math.ceil(inventory.remainingQuantity / ((inventory.quantity - inventory.remainingQuantity) / Math.floor((new Date().getTime() - inventory.purchaseDate.getTime()) / (1000 * 60 * 60 * 24)) || 1))} วัน
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={() => router.push('/inventory')}
              className="btn btn-ghost w-full"
            >
              กลับหน้าคลัง
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}