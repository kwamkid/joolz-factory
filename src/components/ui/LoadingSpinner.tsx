// src/components/ui/LoadingSpinner.tsx
'use client';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'yellow' | 'white' | 'blue' | 'green';
  text?: string;
  className?: string;
}

export default function LoadingSpinner({
  size = 'md',
  color = 'yellow',
  text,
  className = ''
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  const colorClasses = {
    yellow: 'border-yellow-500 border-t-transparent',
    white: 'border-white border-t-transparent',
    blue: 'border-blue-500 border-t-transparent',
    green: 'border-green-500 border-t-transparent'
  };

  const textColorClasses = {
    yellow: 'text-yellow-400',
    white: 'text-white',
    blue: 'text-blue-400',
    green: 'text-green-400'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div
        className={`animate-spin rounded-full border-4 ${sizeClasses[size]} ${colorClasses[color]}`}
      />
      {text && (
        <p className={`mt-3 font-medium ${textColorClasses[color]}`}>
          {text}
        </p>
      )}
    </div>
  );
}

// FullScreen Loading Component
export function FullScreenLoading({ text = 'กำลังโหลด...' }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#00231F' }}>
      <LoadingSpinner 
        size="xl" 
        color="yellow" 
        text={text}
        className="animate-fade-in"
      />
    </div>
  );
}