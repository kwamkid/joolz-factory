// src/components/production/ProductSelector.tsx
'use client';

import { Package } from 'lucide-react';
import { Product } from '@/types/production';

interface ProductSelectorProps {
  products: Product[];
  selectedProduct: Product | null;
  onSelectProduct: (product: Product) => void;
  disabled?: boolean;
}

export default function ProductSelector({
  products,
  selectedProduct,
  onSelectProduct,
  disabled = false
}: ProductSelectorProps) {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-white mb-4">เลือกผลิตภัณฑ์</h2>
      
      <div className="grid grid-cols-2 gap-3">
        {products.map((product) => (
          <button
            key={product.id}
            onClick={() => onSelectProduct(product)}
            disabled={disabled}
            className={`p-4 rounded-lg border-2 transition-all ${
              selectedProduct?.id === product.id
                ? 'bg-primary text-black border-primary'
                : 'bg-gray-800 text-white border-gray-700 hover:border-gray-600'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {product.imageUrl ? (
              <img 
                src={product.imageUrl} 
                alt={product.name}
                className="h-12 w-12 object-cover rounded-lg mx-auto mb-2"
              />
            ) : (
              <Package className="h-8 w-8 mx-auto mb-2" />
            )}
            <p className="font-medium">{product.name}</p>
            <p className="text-xs opacity-75">{product.nameEn}</p>
          </button>
        ))}
      </div>
    </div>
  );
}