// src/utils/image-upload.ts
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export interface ImageUploadOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  folder?: string;
}

/**
 * Resize image using canvas
 */
export const resizeImage = (
  file: File, 
  maxWidth: number = 800, 
  maxHeight: number = 800, 
  quality: number = 0.85
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Draw resized image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
};

/**
 * Upload image to Firebase Storage
 */
export const uploadImage = async (
  file: File,
  options: ImageUploadOptions = {}
): Promise<string> => {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.85,
    folder = 'images'
  } = options;
  
  try {
    // Resize image
    const resizedBlob = await resizeImage(file, maxWidth, maxHeight, quality);
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = file.type.split('/')[1] || 'jpg';
    const filename = `${timestamp}_${randomString}.${extension}`;
    const filepath = `${folder}/${filename}`;
    
    // Upload to Firebase Storage
    const storageRef = ref(storage, filepath);
    const snapshot = await uploadBytes(storageRef, resizedBlob, {
      contentType: 'image/jpeg',
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString()
      }
    });
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw new Error('ไม่สามารถอัพโหลดรูปภาพได้');
  }
};

/**
 * Delete image from Firebase Storage
 */
export const deleteImage = async (imageUrl: string): Promise<void> => {
  try {
    // Extract path from URL
    const baseUrl = 'https://firebasestorage.googleapis.com/v0/b/';
    if (!imageUrl.startsWith(baseUrl)) {
      throw new Error('Invalid Firebase Storage URL');
    }
    
    // Get the path from URL
    const pathMatch = imageUrl.match(/o\/(.*?)\?/);
    if (!pathMatch || !pathMatch[1]) {
      throw new Error('Could not extract path from URL');
    }
    
    const path = decodeURIComponent(pathMatch[1]);
    const storageRef = ref(storage, path);
    
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting image:', error);
    // Don't throw error for deletion failures
  }
};

/**
 * Validate image file
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (!validTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: 'รองรับเฉพาะไฟล์ JPG, PNG, WebP เท่านั้น' 
    };
  }
  
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: 'ขนาดไฟล์ต้องไม่เกิน 10MB' 
    };
  }
  
  return { valid: true };
};