// src/types/bottle.ts
export interface BottleType {
  id: string;
  name: string;              // ชื่อขนาด เช่น "250ml", "350ml", "1L"
  sizeInMl: number;         // ขนาดเป็น ml เช่น 250, 350, 1000
  pricePerUnit: number;     // ราคาต่อขวด
  imageUrl?: string;        // รูปขวด (optional)
  minStockLevel?: number;   // จำนวนขั้นต่ำในสต็อก
  currentStock: number;     // จำนวดคงเหลือปัจจุบัน
  isActive: boolean;        // สถานะใช้งาน
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface BottleStockMovement {
  id: string;
  bottleTypeId: string;
  bottleTypeName: string;
  movementType: 'in' | 'out' | 'adjust' | 'production' | 'damaged';
  quantity: number;
  previousStock: number;
  newStock: number;
  reference?: string;       // เลขที่อ้างอิง เช่น PO, Production Batch
  notes?: string;
  createdAt: Date;
  createdBy: string;
  createdByName: string;
}