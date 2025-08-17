// src/types/supplier.ts
export interface Supplier {
  id: string;
  name: string;
  contact?: string;           // เบอร์โทร
  address?: string;           // ที่อยู่
  lineId?: string;           // LINE ID
  email?: string;
  
  // Performance Metrics
  rating: number;            // คะแนนเฉลี่ย (1-5)
  totalRatings: number;      // จำนวนครั้งที่ถูกให้คะแนน
  averagePrice: number;      // ราคาเฉลี่ย ฿/kg
  totalPurchases: number;    // จำนวนครั้งที่ซื้อ
  totalAmount: number;       // ยอดซื้อรวม
  
  // Status
  status: 'active' | 'banned';
  bannedReason?: string;
  bannedDate?: Date;
  bannedBy?: string;
  
  // Raw Materials
  rawMaterials: string[];    // วัตถุดิบที่ขาย เช่น ['ส้ม', 'เลม่อน']
  
  // Timestamps
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  updatedBy?: string;
  lastPurchase?: Date;
}

export interface SupplierRating {
  id: string;
  supplierId: string;
  supplierName: string;
  purchaseId: string;        // Reference to purchase
  rating: number;            // 1-5
  comment?: string;
  
  // Rating categories
  qualityRating: number;     // คุณภาพสินค้า
  priceRating: number;       // ราคา
  serviceRating: number;     // การบริการ
  deliveryRating: number;    // การจัดส่ง
  
  ratedBy: string;
  ratedByName: string;
  ratedAt: Date;
}

export interface RawMaterial {
  id: string;
  name: string;              // ชื่อวัตถุดิบ เช่น 'ส้ม', 'เลม่อน'
  unit: string;              // หน่วย เช่น 'kg', 'ลูก'
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
}