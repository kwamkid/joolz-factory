// Path: app/(protected)/inventory/[typeId]/transactions/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { InventoryTransactionForm } from '@/components/inventory/InventoryTransactionForm'
import { db } from '@/lib/firebase'
import { doc, getDoc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { ArrowLeft, Plus, Minus, Trash2, Package } from 'lucide-react'

// Format date helper
const formatDate = (timestamp: any) => {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

interface InventoryType {
  id: string
  name: string
  unit: string
  quantity: number
  minQuantity: number
}

interface Transaction {
  id: string
  type: 'in' | 'out' | 'waste'
  quantity: number
  quantityChange: number
  price?: number
  totalCost?: number
  notes?: string
  imageUrl?: string
  createdByName: string
  createdAt: any
}

export default function InventoryTransactionsPage() {
  const params = useParams()
  const router = useRouter()
  const typeId = params.typeId as string
  
  const [inventoryType, setInventoryType] = useState<InventoryType | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [showForm, setShowForm] = useState(false)
  const [transactionType, setTransactionType] = useState<'in' | 'out' | 'waste'>('in')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get inventory type data
    const fetchInventoryType = async () => {
      const docSnap = await getDoc(doc(db, 'inventory_types', typeId))
      if (docSnap.exists()) {
        setInventoryType({
          id: docSnap.id,
          ...docSnap.data()
        } as InventoryType)
      }
    }

    fetchInventoryType()

    // Subscribe to transactions
    const q = query(
      collection(db, 'inventory_transactions'),
      where('inventoryTypeId', '==', typeId),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transactionData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[]
      
      setTransactions(transactionData)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [typeId])

  const openForm = (type: 'in' | 'out' | 'waste') => {
    setTransactionType(type)
    setShowForm(true)
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'in':
        return <Plus className="w-4 h-4 text-green-500" />
      case 'out':
        return <Minus className="w-4 h-4 text-blue-500" />
      case 'waste':
        return <Trash2 className="w-4 h-4 text-red-500" />
      default:
        return null
    }
  }

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'in':
        return 'เพิ่มเข้า'
      case 'out':
        return 'ตัดออก'
      case 'waste':
        return 'ของเสีย'
      default:
        return ''
    }
  }

  if (loading || !inventoryType) {
    return (
      <div className="min-h-screen bg-secondary p-4">
        <div className="text-center text-gray-400">กำลังโหลด...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.push('/inventory')}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <h1 className="text-xl font-semibold text-white">
              รายการเคลื่อนไหว - {inventoryType.name}
            </h1>
          </div>

          {/* Current Stock Status */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-sm text-gray-400">คงเหลือ</p>
                  <p className="text-2xl font-bold text-white">
                    {inventoryType.quantity.toLocaleString('th-TH')} {inventoryType.unit}
                  </p>
                </div>
              </div>
              {inventoryType.quantity <= inventoryType.minQuantity && (
                <span className="px-3 py-1 bg-red-600 text-white text-sm rounded-full">
                  ใกล้หมด
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-4xl mx-auto">
        {!showForm ? (
          <>
            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <button
                onClick={() => openForm('in')}
                className="btn bg-green-600 hover:bg-green-700 text-white"
              >
                <Plus className="w-5 h-5 mr-2" />
                เพิ่มเข้า
              </button>
              <button
                onClick={() => openForm('out')}
                className="btn bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Minus className="w-5 h-5 mr-2" />
                ตัดออก
              </button>
              <button
                onClick={() => openForm('waste')}
                className="btn bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-5 h-5 mr-2" />
                ของเสีย
              </button>
            </div>

            {/* Transaction List */}
            <div className="space-y-3">
              {transactions.length === 0 ? (
                <div className="card p-8 text-center">
                  <p className="text-gray-400">ยังไม่มีรายการเคลื่อนไหว</p>
                </div>
              ) : (
                transactions.map((transaction) => (
                  <div key={transaction.id} className="card p-4">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="mt-1">
                        {getTransactionIcon(transaction.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-white">
                              {getTransactionLabel(transaction.type)}
                            </p>
                            <p className="text-2xl font-bold text-primary">
                              {transaction.type === 'in' ? '+' : '-'}
                              {transaction.quantity.toLocaleString('th-TH')} {inventoryType.unit}
                            </p>
                          </div>
                          {transaction.totalCost && (
                            <div className="text-right">
                              <p className="text-sm text-gray-400">มูลค่า</p>
                              <p className="font-semibold text-white">
                                ฿{transaction.totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          )}
                        </div>

                        {transaction.notes && (
                          <p className="text-sm text-gray-400">
                            หมายเหตุ: {transaction.notes}
                          </p>
                        )}

                        {transaction.imageUrl && (
                          <img
                            src={transaction.imageUrl}
                            alt="Transaction"
                            className="w-full max-w-xs h-40 object-cover rounded-lg mt-2"
                          />
                        )}

                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{transaction.createdByName}</span>
                          <span>{formatDate(transaction.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="card p-4">
            <InventoryTransactionForm
              inventoryType={inventoryType}
              transactionType={transactionType}
              onSuccess={() => {
                setShowForm(false)
                // Refresh will happen automatically via onSnapshot
              }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}