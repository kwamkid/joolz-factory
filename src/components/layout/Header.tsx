// components/layout/Header.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Bell, Search, User, Menu, LogOut, Settings, ChevronDown } from 'lucide-react';

interface HeaderProps {
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  actions?: React.ReactNode;
  onMenuClick?: () => void;
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
}

export default function Header({ 
  showSearch = false,
  searchValue = '',
  onSearchChange,
  actions,
  onMenuClick,
  userName = 'User',
  userRole = 'พนักงาน',
  onLogout
}: HeaderProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ปิด dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  return (
    <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-30">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        {/* Left Side */}
        <div className="flex items-center gap-4 flex-1">
          {/* Mobile Menu Button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Search Bar */}
          {showSearch && (
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="ค้นหา..."
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
          )}
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          {/* Custom Actions */}
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}

          {/* Notifications */}
          <button className="relative p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
            <Bell className="h-5 w-5" />
            <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full animate-pulse"></span>
          </button>

          {/* User Menu */}
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <div className="h-8 w-8 bg-gradient-to-br from-primary to-primary-dark rounded-lg flex items-center justify-center">
                <span className="text-secondary font-bold text-sm">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm text-white font-medium">{userName}</p>
                <p className="text-xs text-gray-400">{userRole}</p>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 z-50">
                <div className="px-4 py-3 border-b border-gray-700">
                  <p className="text-sm text-white font-medium">{userName}</p>
                  <p className="text-xs text-gray-400">{userRole}</p>
                </div>
                
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    // Navigate to profile
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                >
                  <User className="h-4 w-4" />
                  <span className="text-sm">โปรไฟล์</span>
                </button>
                
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    // Navigate to settings
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  <span className="text-sm">ตั้งค่า</span>
                </button>
                
                <div className="border-t border-gray-700 mt-1">
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      onLogout?.();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="text-sm">ออกจากระบบ</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}