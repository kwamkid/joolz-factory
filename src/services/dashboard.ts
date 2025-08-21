// Path: src/services/dashboard.ts
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ProductionBatch } from '@/types/production';
import { InventoryBatch } from '@/types/inventory';
import { Supplier } from '@/types/supplier';
import { BottleType } from '@/types/bottle';

export interface DashboardStats {
  todayProduction: number;
  pendingProduction: number;
  activeSuppliers: number;
  todayRevenue: number;
  productionTrend: 'up' | 'down' | 'stable';
  productionTrendValue: string;
}

export interface RecentProductionItem {
  id: string;
  batchId: string;
  product: string;
  quantity: number;
  bottleDetails: { size: string; quantity: number }[];
  status: 'completed' | 'in_progress';
  time: string;
  date: string;
}

export interface PendingProductionItem {
  id: string;
  batchId: string;
  product: string;
  plannedBottles: { size: string; quantity: number }[];
  productionDate?: string;
  createdTime: string;
}

export interface MaterialStockItem {
  name: string;
  current: number;
  unit: string;
  status: 'normal' | 'low' | 'critical';
  percentage: number;
  minimum: number;
}

export interface LowStockItem {
  name: string;
  current: number;
  unit: string;
  minimum: number;
  percentage: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentProduction: RecentProductionItem[];
  pendingProduction: PendingProductionItem[];
  materialStock: MaterialStockItem[];
  lowStockItems: LowStockItem[];
}

class DashboardService {
  private bottleCache: Map<string, BottleType> = new Map();

  /**
   * ดึงข้อมูลทั้งหมดสำหรับ Dashboard
   */
  async getDashboardData(): Promise<DashboardData> {
    // Load bottle types first for cache
    await this.loadBottleTypes();

    const [stats, recentProduction, pendingProduction, materialStock] = await Promise.all([
      this.getStats(),
      this.getRecentProduction(),
      this.getPendingProduction(),
      this.getMaterialStock()
    ]);

    // Extract low stock items from material stock
    const lowStockItems = materialStock
      .filter(item => item.status === 'low' || item.status === 'critical')
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 3);

    return {
      stats,
      recentProduction,
      pendingProduction,
      materialStock,
      lowStockItems
    };
  }

  /**
   * Load bottle types for cache
   */
  private async loadBottleTypes(): Promise<void> {
    const snapshot = await getDocs(collection(db, 'bottle_types'));
    snapshot.forEach(doc => {
      const data = doc.data() as BottleType;
      this.bottleCache.set(doc.id, { ...data, id: doc.id });
    });
  }

  /**
   * Get bottle size name
   */
  private getBottleSize(bottleId: string): string {
    const bottle = this.bottleCache.get(bottleId);
    return bottle?.name || bottleId;
  }

  /**
   * ดึงสถิติหลัก
   */
  private async getStats(): Promise<DashboardStats> {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    
    // ดึงข้อมูลการผลิตวันนี้
    const productionQuery = query(
      collection(db, 'production_batches'),
      where('completedAt', '>=', Timestamp.fromDate(startOfToday)),
      where('completedAt', '<=', Timestamp.fromDate(endOfToday)),
      where('status', '==', 'completed')
    );
    
    const productionSnapshot = await getDocs(productionQuery);
    let todayProduction = 0;
    let todayRevenue = 0;
    
    productionSnapshot.forEach((doc) => {
      const data = doc.data() as ProductionBatch;
      if (data.actualBottlesProduced) {
        const bottles = Object.values(data.actualBottlesProduced).reduce((sum, qty) => sum + qty, 0);
        todayProduction += bottles;
      }
      todayRevenue += todayProduction * 35;
    });

    // ดึงจำนวนที่รอผลิต
    const pendingQuery = query(
      collection(db, 'production_batches'),
      where('status', '==', 'planned')
    );
    
    const pendingSnapshot = await getDocs(pendingQuery);
    const pendingProduction = pendingSnapshot.size;

    // ดึงจำนวน supplier ที่ active
    const supplierQuery = query(
      collection(db, 'suppliers'),
      where('status', '==', 'active')
    );
    
    const supplierSnapshot = await getDocs(supplierQuery);
    const activeSuppliers = supplierSnapshot.size;

    // คำนวณ trend
    const productionTrend = todayProduction > 400 ? 'up' : todayProduction < 400 ? 'down' : 'stable';
    const productionTrendValue = productionTrend === 'up' ? '+12%' : productionTrend === 'down' ? '-5%' : '0%';

    return {
      todayProduction,
      pendingProduction,
      activeSuppliers,
      todayRevenue,
      productionTrend,
      productionTrendValue
    };
  }

  /**
   * ดึงข้อมูลการผลิตล่าสุด (เฉพาะ completed และ in_progress)
   */
  private async getRecentProduction(): Promise<RecentProductionItem[]> {
    const productionQuery = query(
      collection(db, 'production_batches'),
      where('status', 'in', ['completed', 'in_progress']),
      orderBy('completedAt', 'desc'),
      limit(5)
    );
    
    const snapshot = await getDocs(productionQuery);
    const items: RecentProductionItem[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data() as ProductionBatch;
      
      // Get bottle details
      const bottleDetails: { size: string; quantity: number }[] = [];
      const bottlesData = data.status === 'completed' ? data.actualBottlesProduced : data.plannedBottles;
      
      if (bottlesData) {
        Object.entries(bottlesData).forEach(([bottleId, quantity]) => {
          if (quantity > 0) {
            bottleDetails.push({
              size: this.getBottleSize(bottleId),
              quantity
            });
          }
        });
      }

      // Calculate total quantity
      const quantity = bottleDetails.reduce((sum, item) => sum + item.quantity, 0);
      
      // Format time and date
      const dateValue = data.completedAt || data.startedAt || data.plannedAt;
      const dateObj = dateValue instanceof Timestamp ? dateValue.toDate() : dateValue;
      const time = dateObj.toLocaleTimeString('th-TH', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      const date = dateObj.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short'
      });
      
      items.push({
        id: doc.id,
        batchId: data.batchId,
        product: data.productName,
        quantity,
        bottleDetails,
        status: data.status as 'completed' | 'in_progress',
        time,
        date
      });
    });
    
    return items;
  }

  /**
   * ดึงข้อมูลที่รอผลิต
   */
  private async getPendingProduction(): Promise<PendingProductionItem[]> {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const productionQuery = query(
      collection(db, 'production_batches'),
      where('status', '==', 'planned'),
      orderBy('productionDate', 'asc'),
      orderBy('plannedAt', 'asc'),
      limit(5)
    );
    
    const snapshot = await getDocs(productionQuery);
    const items: PendingProductionItem[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data() as ProductionBatch;
      
      // Get bottle details
      const plannedBottles: { size: string; quantity: number }[] = [];
      
      if (data.plannedBottles) {
        Object.entries(data.plannedBottles).forEach(([bottleId, quantity]) => {
          if (quantity > 0) {
            plannedBottles.push({
              size: this.getBottleSize(bottleId),
              quantity
            });
          }
        });
      }
      
      // Format time
      const dateValue = data.plannedAt;
      const date = dateValue instanceof Timestamp ? dateValue.toDate() : dateValue;
      const createdTime = date.toLocaleTimeString('th-TH', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      items.push({
        id: doc.id,
        batchId: data.batchId,
        product: data.productName,
        plannedBottles,
        productionDate: data.productionDate,
        createdTime
      });
    });
    
    return items;
  }

  /**
   * ดึงข้อมูลสต็อกวัตถุดิบแยกตามประเภท
   */
  private async getMaterialStock(): Promise<MaterialStockItem[]> {
    // Load raw materials from database
    const materialsSnapshot = await getDocs(collection(db, 'raw_materials'));
    const materials: Record<string, { unit: string; minStockLevel: number }> = {};
    
    materialsSnapshot.forEach((doc) => {
      const data = doc.data();
      materials[data.name] = {
        unit: data.unit || 'kg',
        minStockLevel: data.minStockLevel || 50
      };
    });
    
    // Group inventory by material type
    const inventoryQuery = query(
      collection(db, 'inventory_batches'),
      where('status', '==', 'active')
    );
    
    const snapshot = await getDocs(inventoryQuery);
    const materialStock: Record<string, number> = {};
    
    snapshot.forEach((doc) => {
      const data = doc.data() as InventoryBatch;
      if (!materialStock[data.materialType]) {
        materialStock[data.materialType] = 0;
      }
      materialStock[data.materialType] += data.remainingQuantity;
    });
    
    // Create material stock items
    const stockItems: MaterialStockItem[] = [];
    
    // Add all materials from database
    Object.entries(materials).forEach(([materialName, materialInfo]) => {
      const current = materialStock[materialName] || 0;
      const minimum = materialInfo.minStockLevel;
      const percentage = (current / minimum) * 100;
      
      let status: 'normal' | 'low' | 'critical' = 'normal';
      if (percentage <= 25) {
        status = 'critical';
      } else if (percentage <= 50) {
        status = 'low';
      }
      
      stockItems.push({
        name: materialName,
        current,
        unit: materialInfo.unit,
        status,
        percentage,
        minimum
      });
    });
    
    // Sort by percentage (lowest first)
    stockItems.sort((a, b) => a.percentage - b.percentage);
    
    return stockItems;
  }
}

export const dashboardService = new DashboardService();