// Path: src/types/raw-material.ts
export interface RawMaterial {
  id: string;
  name: string;              // ชื่อวัตถุดิบ เช่น 'ส้ม', 'เลม่อน'
  unit: string;              // หน่วย เช่น 'kg', 'ลิตร', 'ขวด'
  minStockLevel: number;     // จำนวนขั้นต่ำ (สำหรับแจ้งเตือน)
  imageUrl?: string;         // รูปวัตถุดิบ
  isActive: boolean;         // สถานะการใช้งาน
  
  // Timestamps
  createdAt: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface RawMaterialStock {
  materialId: string;
  materialName: string;
  totalQuantity: number;     // จำนวนรวมในคลัง
  unit: string;
  lastUpdated: Date;
}