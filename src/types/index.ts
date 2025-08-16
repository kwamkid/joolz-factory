// User Types
export type UserRole = 'operation' | 'manager' | 'admin';

export interface User {
  id: string;
  email?: string;
  name: string;
  picture?: string;
  role: UserRole;
  lineId?: string;
  createdAt: Date;
  createdBy?: string;
  lastLogin?: Date;
}

// Supplier Types
export interface Supplier {
  id: string;
  name: string;
  contact?: string;
  address?: string;
  lineId?: string;
  email?: string;
  rating: number;
  totalRatings: number;
  averagePrice: number;
  status: 'active' | 'banned';
  bannedReason?: string;
  bannedDate?: Date;
  createdBy: string;
  createdAt: Date;
  lastPurchase?: Date;
}

export interface SupplierRating {
  id: string;
  supplierId: string;
  rating: number; // 1-5
  comment?: string;
  ratedBy: string;
  ratedAt: Date;
  purchaseId?: string;
}

// Raw Material Types
export interface RawMaterial {
  id: string;
  name: string;
  unit: string; // kg, liter, etc.
  minStockLevel?: number;
  createdAt: Date;
}

// Inventory Types
export interface InventoryBatch {
  id: string;
  batchId: string; // INV240125001
  materialType: string;
  materialId: string;
  supplier: {
    id: string;
    name: string;
    rating: number;
  };
  purchaseDate: Date;
  quantity: number;
  remainingQuantity: number;
  pricePerUnit: number;
  totalCost: number;
  invoiceNumber?: string;
  invoiceUrl?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  isFinished: boolean;
}

// Bottle Types
export interface BottleType {
  id: string;
  size: string; // 250ml, 350ml, 1L
  sizeInMl: number; // 250, 350, 1000
  pricePerUnit: number;
  imageUrl?: string;
  createdAt: Date;
  updatedAt?: Date;
}

// Product Types
export interface Product {
  id: string;
  name: string;
  nameEn: string;
  rawMaterials: string[]; // Material IDs
  qualityTests: QualityTestType[];
  bottleSizes: string[]; // Bottle type IDs
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface QualityTestType {
  name: string;
  unit: string;
  minValue?: number;
  maxValue?: number;
}

// Production Types
export interface ProductionBatch {
  id: string;
  batchId: string; // OJ250724001
  productId: string;
  productName: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  
  // Planning data
  plannedBottles: {
    [bottleTypeId: string]: number;
  };
  totalJuiceNeeded: number; // liters
  materialRequirements: {
    [materialId: string]: {
      quantity: number;
      estimatedCost?: number; // Only for admin
    };
  };
  
  // Actual production data
  actualMaterialsUsed?: {
    [materialId: string]: number;
  };
  actualBottlesProduced?: {
    [bottleTypeId: string]: number;
  };
  
  // Costs (calculated by system, hidden from operation)
  materialCost?: number;
  bottleCost?: number;
  totalCost?: number;
  
  // Metadata
  plannedBy: string;
  plannedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  completedBy?: string;
  notes?: string;
}

// Quality Test Types
export interface QualityTest {
  id: string;
  batchId: string;
  productionBatchId: string;
  testType: 'before_mixing' | 'after_mixing';
  tests: {
    [testName: string]: {
      value: number;
      photoUrl?: string;
    };
  };
  notes?: string;
  testedBy: string;
  testedAt: Date;
}