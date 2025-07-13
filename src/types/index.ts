// src/types/index.ts
export type UserRole = 'operation' | 'manager' | 'admin';

export interface User {
  id: string;
  lineId: string;
  name: string;
  pictureUrl?: string;
  roles: UserRole[];
  phone?: string;
  isActive: boolean;
  createdAt: Date;
  createdBy?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  address?: string;
  lineId?: string;
  email?: string;
  rating: number;
  totalRatings: number;
  averagePrice: number;
  status: 'active' | 'banned';
  bannedReason?: string;
  bannedDate?: Date;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface SupplierRating {
  id: string;
  supplierId: string;
  batchId: string;
  rating: number;
  comment?: string;
  ratedBy: string;
  ratedAt: Date;
}

export interface RawMaterial {
  id: string;
  name: string;
  category: 'fruit' | 'herb';
  unit: string;
  isActive: boolean;
}

export interface InventoryBatch {
  id: string;
  materialId: string;
  supplierId: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  purchaseDate: Date;
  remainingQuantity: number;
  invoiceNumber?: string;
  notes?: string;
  isFinished: boolean;
}

export interface BottleType {
  id: string;
  name: string;
  volume: number;
  unit: string;
  pricePerBottle: number;
  imageUrl?: string;
  isActive: boolean;
}

export type ProductType = 'orange' | 'lemon' | 'herbal';

export interface ProductionBatch {
  id: string;
  batchId: string; // Generated batch ID like OJ250724001
  productType: ProductType;
  productionDate: Date;
  materials: {
    materialId: string;
    supplierId: string;
    batchId: string;
    quantityUsed: number;
    costPerUnit: number;
  }[];
  bottlesProduced: {
    bottleTypeId: string;
    quantity: number;
    totalVolume: number;
  }[];
  totalCost: number;
  costPerBottle: Record<string, number>;
  producedBy: string;
  status: 'planning' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
}

export interface QualityTest {
  id: string;
  productionId: string;
  productType: ProductType;
  testStage: 'before_mix' | 'after_mix';
  testData: Record<string, any>; // Dynamic based on product type
  photos: string[];
  notes?: string;
  testedBy: string;
  testedAt: Date;
}

// Production Planning
export interface ProductionPlan {
  productType: ProductType;
  bottles: {
    bottleTypeId: string;
    quantity: number;
  }[];
  estimatedMaterials: {
    materialId: string;
    estimatedQuantity: number;
  }[];
  estimatedCost?: number; // Only for admin
  batchId: string;
}

// FIFO Calculation Result
export interface FIFOResult {
  status: 'success' | 'error';
  message?: string;
  totalCost: number;
  averageCostPerUnit: number;
  details: {
    lotId: string;
    usedQuantity: number;
    pricePerUnit: number;
    cost: number;
    purchaseDate: Date;
  }[];
}