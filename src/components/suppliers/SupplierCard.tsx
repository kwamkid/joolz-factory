// src/components/suppliers/SupplierCard.tsx
'use client';

import { Phone, MapPin, Shield, ShieldOff, Edit, Star, Calendar, MessageCircle } from 'lucide-react';
import { Supplier } from '@/types';
import StarRating from '@/components/ui/StarRating';

interface SupplierCardProps {
  supplier: Supplier;
  onEdit: (supplier: Supplier) => void;
  onToggleStatus: (supplier: Supplier) => void;
  onRate?: (supplier: Supplier) => void;
}

export default function SupplierCard({
  supplier,
  onEdit,
  onToggleStatus,
  onRate
}: SupplierCardProps) {
  return (
    <div
      className={`bg-gray-800 rounded-xl p-6 border transition-all hover:shadow-xl ${
        supplier.status === 'active' 
          ? 'border-gray-600 hover:border-yellow-500' 
          : 'border-red-600'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h3 className="text-lg font-bold text-white">{supplier.name}</h3>
            {supplier.status === 'active' ? (
              <Shield className="h-5 w-5 text-green-400" />
            ) : (
              <ShieldOff className="h-5 w-5 text-red-400" />
            )}
          </div>
          
          <StarRating 
            rating={supplier.rating} 
            size="sm"
            className="mb-2"
          />
          
          {supplier.totalRatings > 0 && (
            <p className="text-xs text-gray-400">
              ให้คะแนนแล้ว {supplier.totalRatings} ครั้ง
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {onRate && supplier.status === 'active' && (
            <button
              onClick={() => onRate(supplier)}
              className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-gray-700 rounded-lg transition-colors"
              title="ให้คะแนน"
            >
              <Star className="h-5 w-5" />
            </button>
          )}
          
          <button
            onClick={() => onEdit(supplier)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="แก้ไข"
          >
            <Edit className="h-5 w-5" />
          </button>
          
          <button
            onClick={() => onToggleStatus(supplier)}
            className={`p-2 rounded-lg transition-colors ${
              supplier.status === 'active'
                ? 'text-red-400 hover:text-red-300 hover:bg-red-900/20'
                : 'text-green-400 hover:text-green-300 hover:bg-green-900/20'
            }`}
            title={supplier.status === 'active' ? 'ระงับ' : 'เปิดใช้งาน'}
          >
            {supplier.status === 'active' ? (
              <ShieldOff className="h-5 w-5" />
            ) : (
              <Shield className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-3">
        <div className="flex items-center space-x-3 text-gray-300">
          <Phone className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{supplier.contact}</span>
        </div>
        
        {supplier.address && (
          <div className="flex items-start space-x-3 text-gray-300">
            <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="text-sm leading-relaxed">{supplier.address}</span>
          </div>
        )}

        {supplier.lineId && (
          <div className="flex items-center space-x-3 text-gray-300">
            <MessageCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">LINE: {supplier.lineId}</span>
          </div>
        )}
      </div>

      {/* Ban Notice */}
      {supplier.status === 'banned' && supplier.bannedReason && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-600 rounded-lg">
          <p className="text-red-300 text-sm">
            <strong>สาเหตุการระงับ:</strong> {supplier.bannedReason}
          </p>
          {supplier.bannedDate && (
            <p className="text-red-400 text-xs mt-1">
              ระงับเมื่อ: {supplier.bannedDate.toLocaleDateString('th-TH')}
            </p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-700">
        <div className="flex items-center space-x-2 text-gray-400 text-sm">
          <Calendar className="h-4 w-4" />
          <span>สร้างเมื่อ {supplier.createdAt.toLocaleDateString('th-TH')}</span>
        </div>
        
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          supplier.status === 'active'
            ? 'bg-green-900/20 text-green-400 border border-green-600'
            : 'bg-red-900/20 text-red-400 border border-red-600'
        }`}>
          {supplier.status === 'active' ? 'ใช้งานได้' : 'ระงับแล้ว'}
        </span>
      </div>
    </div>
  );
}