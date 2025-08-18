// src/components/production/BottleQuantityInput.tsx
'use client';

import { Plus, Minus } from 'lucide-react';
import { BottleType } from '@/types/bottle';

interface BottleQuantityInputProps {
  bottleTypes: BottleType[];
  quantities: Record<string, number>;
  onQuantityChange: (bottleId: string, quantity: number) => void;
  disabled?: boolean;
}

export default function BottleQuantityInput({
  bottleTypes,
  quantities,
  onQuantityChange,
  disabled = false
}: BottleQuantityInputProps) {
  const handleChange = (bottleId: string, change: number) => {
    const currentQty = quantities[bottleId] || 0;
    const newQty = Math.max(0, currentQty + change);
    onQuantityChange(bottleId, newQty);
  };

  const handleInputChange = (bottleId: string, value: string) => {
    const qty = parseInt(value) || 0;
    onQuantityChange(bottleId, Math.max(0, qty));
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-white mb-4">จำนวนที่ต้องการผลิต</h2>
      
      <div className="space-y-4">
        {bottleTypes.map((bottle) => (
          <div key={bottle.id} className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">{bottle.name}</p>
              <p className="text-xs text-gray-400">
                สต็อกขวด: {bottle.currentStock} ขวด
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleChange(bottle.id, -10)}
                disabled={disabled}
                className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded disabled:opacity-50"
              >
                <Minus className="h-4 w-4" />
              </button>
              
              <input
                type="number"
                value={quantities[bottle.id] || 0}
                onChange={(e) => handleInputChange(bottle.id, e.target.value)}
                disabled={disabled}
                className="w-20 text-center input"
                min="0"
              />
              
              <button
                onClick={() => handleChange(bottle.id, 10)}
                disabled={disabled}
                className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
              </button>
              
              <span className="text-gray-400 text-sm w-12">ขวด</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}