// src/types/production.ts
export interface Product {
  id: string;
  name: string;
  nameEn: string;
  category?: string;
  rawMaterials: string[];  // วัตถุดิบที่ใช้
  averageRatios?: {        // ค่าเฉลี่ยจากประวัติการผลิต
    [materialType: string]: {
      avgPerLiter: number;
      minPerLiter: number;
      maxPerLiter: number;
      lastUpdated: Date;
      totalBatches: number;
    }
  };
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface QualityTest {
  name: string;
  unit: string;
  minValue?: number;
  maxValue?: number;
  required: boolean;
}

export interface ProductionBatch {
  id: string;
  batchId: string;
  productId: string;
  productName: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  
  // Planning data
  plannedBottles: Record<string, number>; // bottleId -> quantity
  totalJuiceNeeded: number; // liters
  materialRequirements: Record<string, MaterialRequirement>;
  
  // Actual production data
  actualMaterialsUsed?: Record<string, number>; // materialType -> kg
  actualBottlesProduced?: Record<string, number>; // bottleId -> quantity
  
  // Quality data
  qualityTests?: QualityTestResult[];
  
  // Costs (calculated by system, hidden from operation)
  materialCost?: number;
  bottleCost?: number;
  totalCost?: number;
  
  // Metadata
  plannedBy: string;
  plannedByName: string;
  plannedAt: Date;
  startedAt?: Date;
  startedBy?: string;
  startedByName?: string;
  completedAt?: Date;
  completedBy?: string;
  completedByName?: string;
  notes?: string;
}

export interface MaterialRequirement {
  quantity: number;
  estimatedCost?: number; // Only for admin
}

export interface QualityTestResult {
  testName: string;
  testType: 'before_mixing' | 'after_mixing';
  value: number;
  unit: string;
  photoUrl?: string;
  passed: boolean;
  testedAt: Date;
  testedBy: string;
  testedByName: string;
  notes?: string;
}

export interface ProductionSummary {
  totalBatches: number;
  plannedBatches: number;
  inProgressBatches: number;
  completedBatches: number;
  totalBottlesProduced: number;
  totalMaterialUsed: number;
  totalCost?: number; // Admin only
}