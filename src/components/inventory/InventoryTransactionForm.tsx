// Path: components/inventory/InventoryTransactionForm.tsx
'use client'

import { useState } from 'react'
// Path: components/inventory/InventoryTransactionForm.tsx
import { db, storage } from '@/lib/firebase'
import { collection, addDoc, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useAuth } from '@/lib/auth-context'
import { Camera, X } from 'lucide-react'

interface InventoryTransactionFormProps {
  inventoryType: {
    id: string
    name: string
    unit: string
  }
  transactionType: 'in' | 'out' | 'waste'
  onSuccess?: () => void
  onCancel?: () => void
}

export function InventoryTransactionForm({
  inventoryType,
  transactionType,
  onSuccess,
  onCancel
}: InventoryTransactionFormProps) {
  const { user } = useAuth()
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    
    setLoading(true)
    try {
      let imageUrl = null
      
      // Upload image if exists
      if (imageFile) {
        const timestamp = Date.now()
        const fileName = `inventory/${inventoryType.id}/${transactionType}/${timestamp}_${imageFile.name}`
        const storageRef = ref(storage, fileName)
        const snapshot = await uploadBytes(storageRef, imageFile)
        imageUrl = await getDownloadURL(snapshot.ref)
      }

      // Calculate quantity change
      const quantityChange = transactionType === 'in' 
        ? parseFloat(quantity) 
        : -parseFloat(quantity)

      // Create transaction record
      const transactionData = {
        inventoryTypeId: inventoryType.id,
        type: transactionType,
        quantity: parseFloat(quantity),
        quantityChange,
        price: transactionType === 'in' ? parseFloat(price) : null,
        totalCost: transactionType === 'in' ? parseFloat(price) * parseFloat(quantity) : null,
        notes,
        imageUrl,
        createdBy: user.uid,
        createdByName: user.email || 'Unknown',
        createdAt: serverTimestamp(),
        status: 'active'
      }

      // Add transaction
      await addDoc(collection(db, 'inventory_transactions'), transactionData)

      // Update inventory type quantity
      const inventoryRef = doc(db, 'inventory_types', inventoryType.id)
      const inventorySnap = await getDoc(inventoryRef)
      
      if (inventorySnap.exists()) {
        const currentData = inventorySnap.data()
        const newQuantity = (currentData.quantity || 0) + quantityChange
        
        await updateDoc(inventoryRef, {
          quantity: newQuantity,
          lastUpdated: serverTimestamp(),
          lastUpdatedBy: user.uid
        })
      }

      // Success
      setQuantity('')
      setPrice('')
      setNotes('')
      setImageFile(null)
      setImagePreview(null)
      
      if (onSuccess) onSuccess()
      
    } catch (error) {
      console.error('Error creating transaction:', error)
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  const getTitle = () => {
    switch (transactionType) {
      case 'in':
        return `เพิ่ม${inventoryType.name}เข้า Stock`
      case 'out':
        return `ตัด${inventoryType.name}ออกจาก Stock`
      case 'waste':
        return `บันทึก${inventoryType.name}เสีย`
    }
  }

  const getButtonText = () => {
    switch (transactionType) {
      case 'in':
        return 'เพิ่มเข้า Stock'
      case 'out':
        return 'ตัดออกจาก Stock'
      case 'waste':
        return 'บันทึกของเสีย'
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold text-white">{getTitle()}</h3>

      {/* Quantity Input */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          จำนวน ({inventoryType.unit})
        </label>
        <input
          type="number"
          step="0.01"
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary"
          placeholder={`กรอกจำนวน${inventoryType.name}`}
        />
      </div>

      {/* Price Input - Only for IN transactions */}
      {transactionType === 'in' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            ราคาต่อ{inventoryType.unit} (บาท)
          </label>
          <input
            type="number"
            step="0.01"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary"
            placeholder="กรอกราคา"
          />
        </div>
      )}

      {/* Total Cost Display */}
      {transactionType === 'in' && quantity && price && (
        <div className="bg-gray-800 p-3 rounded-lg">
          <p className="text-sm text-gray-400">ราคารวม</p>
          <p className="text-lg font-semibold text-primary">
            ฿{(parseFloat(quantity) * parseFloat(price)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
          </p>
        </div>
      )}

      {/* Image Upload - Required for waste */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          {transactionType === 'waste' ? 'รูปของเสีย (จำเป็น)' : 'รูปภาพ (ถ้ามี)'}
        </label>
        
        {!imagePreview ? (
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-700 border-dashed rounded-lg cursor-pointer bg-gray-800 hover:bg-gray-700">
            <Camera className="w-8 h-8 text-gray-400 mb-2" />
            <span className="text-sm text-gray-400">แตะเพื่อถ่ายรูป</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageChange}
              className="hidden"
              required={transactionType === 'waste'}
            />
          </label>
        ) : (
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full h-48 object-cover rounded-lg"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute top-2 right-2 p-1 bg-red-600 rounded-full text-white hover:bg-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          หมายเหตุ {transactionType === 'waste' && '(ระบุสาเหตุ)'}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary"
          placeholder={transactionType === 'waste' ? 'ระบุสาเหตุที่ของเสีย' : 'หมายเหตุเพิ่มเติม'}
          required={transactionType === 'waste'}
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary flex-1"
        >
          {loading ? 'กำลังบันทึก...' : getButtonText()}
        </button>
        
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn btn-ghost"
          >
            ยกเลิก
          </button>
        )}
      </div>
    </form>
  )
}