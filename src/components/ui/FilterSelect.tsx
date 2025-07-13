// src/components/ui/FilterSelect.tsx
'use client';

import { Filter } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  placeholder?: string;
  className?: string;
}

export default function FilterSelect({
  value,
  onChange,
  options,
  placeholder = 'เลือกตัวกรอง',
  className = ''
}: FilterSelectProps) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-gray-800 border border-gray-600 rounded-xl text-white py-3 px-4 pr-10 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all cursor-pointer"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
            {option.count !== undefined && ` (${option.count})`}
          </option>
        ))}
      </select>
      
      <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5 pointer-events-none" />
    </div>
  );
}