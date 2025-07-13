// src/components/suppliers/SupplierRating.tsx
'use client';

import { useState } from 'react';
import { X, Star } from 'lucide-react';
import { addDoc, collection, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { Supplier } from '@/types';
import StarRating from '@/components/ui/StarRating';
import toast from 'react-hot-toast';

interface SupplierRatingProps {
  supplier: Supplier;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SupplierRating({ supplier, onClose, onSuccess }: SupplierRatingProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    
    try {
      // บันทึกการให้คะแนน
      await addDoc(collection(db, 'supplier_ratings'), {
        supplierId: supplier.id,
        rating: rating,
        comment: comment.trim(),
        ratedBy: user.id,
        ratedAt: new Date(),
      });

      // คำนวณคะแนนเฉลี่ยใหม่
      const newTotalRatings = supplier.totalRatings + 1;
      const newAverageRating = ((supplier.rating * supplier.totalRatings) + rating) / newTotalRatings;

      // อัพเดทข้อมูลซัพพลายเออร์
      await updateDoc(doc(db, 'suppliers', supplier.id), {
        rating: newAverageRating,
        totalRatings: newTotalRatings,
      });

      toast.success('ให้คะแนนสำเร็จ!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error rating supplier:', error);
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">ให้คะแนนซัพพลายเออร์</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Supplier Info */}
        <div className="mb-6 p-4 bg-gray-700 rounded-lg">
          <h3 className="font-semibold text-white mb-1">{supplier.name}</h3>
          <p className="text-sm text-gray-300">{supplier.contact}</p>
          <div className="mt-2">
            <StarRating rating={supplier.rating} size="sm" />
          </div>
        </div>

        {/* Rating Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Rating Input */}
          <div>
            <label className="block text-sm font-medium text-white mb-3">
              ให้คะแนน
            </label>
            <div className="flex justify-center">
              <StarRating
                rating={rating}
                onRatingChange={setRating}
                readOnly={false}
                size="lg"
                showValue={false}
              />
            </div>
            <p className="text-center text-gray-300 mt-2">
              {rating} ดาว - {
                rating === 5 ? 'ดีเยี่ยม' :
                rating === 4 ? 'ดี' :
                rating === 3 ? 'ปานกลาง' :
                rating === 2 ? 'แย่' : 'แย่มาก'
              }
            </p>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              ความคิดเห็น (ไม่บังคับ)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all resize-none"
              placeholder="แชร์ประสบการณ์การทำงานกับซัพพลายเออร์นี้..."
              maxLength={500}
            />
            <p className="text-xs text-gray-400 mt-1">
              {comment.length}/500 ตัวอักษร
            </p>
          </div>

          {/* Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition-colors font-medium"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black py-3 rounded-xl transition-colors font-semibold flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-black border-t-transparent"></div>
              ) : (
                <>
                  <Star className="h-5 w-5" />
                  <span>ให้คะแนน</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}