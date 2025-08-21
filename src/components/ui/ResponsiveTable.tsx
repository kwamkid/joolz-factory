// Path: src/components/ui/ResponsiveTable.tsx
'use client';

import React, { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

// Types
export interface TableColumn<T> {
  key: string;
  header: string;
  accessor: (item: T) => ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
  mobileLabel?: string; // Label สำหรับ mobile view
  hideOnMobile?: boolean; // ซ่อนใน mobile view
  mobilePriority?: number; // ลำดับความสำคัญใน mobile (1 = สำคัญสุด)
}

export interface ResponsiveTableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  keyExtractor: (item: T, index: number) => string;
  
  // Desktop Options
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T) => string;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  loading?: boolean;
  
  // Mobile Options
  mobileRenderCard?: (item: T) => ReactNode; // Custom mobile card
  mobileShowViewButton?: boolean;
  mobileViewButtonText?: string;
  onMobileViewClick?: (item: T) => void;
  mobileCardClassName?: string;
}

export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  rowClassName,
  emptyMessage = 'ไม่พบข้อมูล',
  emptyIcon,
  loading = false,
  mobileRenderCard,
  mobileShowViewButton = false,
  mobileViewButtonText = 'ดูรายละเอียด',
  onMobileViewClick,
  mobileCardClassName = ''
}: ResponsiveTableProps<T>) {
  
  // Sort columns by mobile priority
  const mobileColumns = columns
    .filter(col => !col.hideOnMobile)
    .sort((a, b) => (a.mobilePriority || 999) - (b.mobilePriority || 999));

  // Default mobile card renderer
  const renderMobileCard = (item: T, index: number) => {
    if (mobileRenderCard) {
      return mobileRenderCard(item);
    }

    return (
      <div 
        className={`card mb-4 ${mobileCardClassName}`}
        onClick={() => onRowClick?.(item)}
      >
        {/* Main content */}
        <div className="space-y-3">
          {mobileColumns.map((column) => {
            const value = column.accessor(item);
            if (!value) return null;
            
            return (
              <div key={column.key} className="flex flex-col sm:flex-row sm:items-center">
                {column.mobileLabel && (
                  <span className="text-sm text-gray-400 mb-1 sm:mb-0 sm:mr-2 sm:min-w-[120px]">
                    {column.mobileLabel || column.header}:
                  </span>
                )}
                <div className="flex-1">{value}</div>
              </div>
            );
          })}
        </div>

        {/* View button */}
        {mobileShowViewButton && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMobileViewClick?.(item);
            }}
            className="btn btn-ghost btn-sm w-full mt-4 flex items-center justify-center"
          >
            {mobileViewButtonText}
            <ChevronRight className="h-4 w-4 ml-1" />
          </button>
        )}
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-400">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        {emptyIcon && <div className="mb-4">{emptyIcon}</div>}
        <p className="text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile View */}
      <div className="block lg:hidden">
        {data.map((item, index) => (
          <div key={keyExtractor(item, index)}>
            {renderMobileCard(item, index)}
          </div>
        ))}
      </div>

      {/* Desktop View */}
      <div className="hidden lg:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`p-4 text-sm font-medium text-gray-400 
                      ${column.align === 'center' ? 'text-center' : 
                        column.align === 'right' ? 'text-right' : 'text-left'}
                      ${column.className || ''}
                    `}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr
                  key={keyExtractor(item, index)}
                  className={`
                    border-b border-gray-700 hover:bg-gray-800/50 transition-colors
                    ${onRowClick ? 'cursor-pointer' : ''}
                    ${rowClassName?.(item) || ''}
                  `}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`p-4 
                        ${column.align === 'center' ? 'text-center' : 
                          column.align === 'right' ? 'text-right' : 'text-left'}
                        ${column.className || ''}
                      `}
                    >
                      {column.accessor(item)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// Helper Components สำหรับ Cells ที่ใช้บ่อย
export const TableBadge: React.FC<{
  variant: 'success' | 'warning' | 'error' | 'info' | 'default';
  children: ReactNode;
  icon?: ReactNode;
}> = ({ variant, children, icon }) => {
  const variants = {
    success: 'bg-green-900/30 text-green-400',
    warning: 'bg-yellow-900/30 text-yellow-400',
    error: 'bg-red-900/30 text-red-400',
    info: 'bg-blue-900/30 text-blue-400',
    default: 'bg-gray-700 text-gray-300'
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${variants[variant]}`}>
      {icon}
      {children}
    </span>
  );
};

export const TableActions: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  return (
    <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
};

// Export helper function สำหรับ format date
export const formatDate = (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('th-TH', options);
};

export const formatDateTime = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};