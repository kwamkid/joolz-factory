// src/components/production/MaterialRequirementCard.tsx
'use client';

import { AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export interface MaterialRequirementDisplay {
  materialType: string;
  requiredQuantity: number;
  availableQuantity: number;
  estimatedCost: number;
  isEnough: boolean;
}

interface MaterialRequirementCardProps {
  requirements: MaterialRequirementDisplay[];
}

export default function MaterialRequirementCard({ requirements }: MaterialRequirementCardProps) {
  const { user: currentUser } = useAuth();
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (requirements.length === 0) return null;

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-white mb-4">วัตถุดิบที่ต้องใช้</h3>
      
      <div className="space-y-4">
        {requirements.map((req) => (
          <div key={req.materialType}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-medium">{req.materialType}</span>
              <span className={`text-sm ${req.isEnough ? 'text-green-400' : 'text-red-400'}`}>
                {req.isEnough ? '✓ เพียงพอ' : '✗ ไม่พอ'}
              </span>
            </div>
            
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">ต้องใช้</span>
                <span className="text-white">{req.requiredQuantity.toFixed(1)} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">มีในสต็อก</span>
                <span className={req.isEnough ? 'text-white' : 'text-red-400'}>
                  {req.availableQuantity.toFixed(1)} kg
                </span>
              </div>
              {currentUser?.role === 'admin' && (
                <div className="flex justify-between">
                  <span className="text-gray-400">ต้นทุนโดยประมาณ</span>
                  <span className="text-white">{formatCurrency(req.estimatedCost)}</span>
                </div>
              )}
            </div>
            
            {!req.isEnough && (
              <div className="mt-2 p-2 bg-red-900/20 border border-red-600 rounded text-xs text-red-400">
                <AlertCircle className="h-3 w-3 inline mr-1" />
                ขาด {(req.requiredQuantity - req.availableQuantity).toFixed(1)} kg
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}