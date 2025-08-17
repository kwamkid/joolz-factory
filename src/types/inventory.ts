// src/types/inventory.ts
export interface InventoryBatch {
  id: string;
  batchId: string;              // INV240125001
  materialType: string;         // ชื่อวัตถุดิบ เช่น 'ส้ม', 'เลม่อน'
  materialId?: string;          // Reference to raw material
  
  // Supplier Info
  supplier: {
    id: string;
    name: string;
    rating: number;
  };
  
  // Purchase Info
  purchaseDate: Date;
  quantity: number;             // จำนวนที่ซื้อ (kg)
  remainingQuantity: number;    // จำนวนคงเหลือ (kg)
  pricePerUnit: number;         // ราคาต่อหน่วย ฿/kg
  totalCost: number;            // ราคารวม
  
  // Document
  invoiceNumber?: string;       // เลขที่ใบเสร็จ
  invoiceUrl?: string;         // รูปใบเสร็จ
  notes?: string;
  
  // Status
  status: 'active' | 'finished' | 'expired' | 'damaged';
  isFinished: boolean;
  finishedAt?: Date;
  
  // Timestamps
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  expiryDate?: Date;           // วันหมดอายุ (ถ้ามี)
}

export interface InventoryMovement {
  id: string;
  batchId: string;              // Reference to inventory batch
  materialType: string;
  movementType: 'in' | 'out' | 'damage' | 'expire' | 'adjust';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  
  // For damage/expire
  damageReason?: string;
  damagePhotoUrl?: string;
  
  // Reference
  reference?: string;           // Production batch ID, etc.
  referenceType?: 'production' | 'damage' | 'expire' | 'manual';
  
  notes?: string;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
}

export interface DamageRecord {
  id: string;
  batchId: string;
  materialType: string;
  quantity: number;             // จำนวนที่เสีย
  reason: string;               // เหตุผล
  photoUrl?: string;            // รูปของเสีย
  
  // Cost Impact
  unitCost: number;             // ต้นทุนต่อหน่วย
  totalLoss: number;            // มูลค่าความเสียหาย
  
  reportedBy: string;
  reportedByName: string;
  reportedAt: Date;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: Date;
  status: 'pending' | 'approved' | 'rejected';
}