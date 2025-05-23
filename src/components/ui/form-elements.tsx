'use client';

import React from 'react';

interface CheckboxProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onChange, disabled = false, label }) => {
  return (
    <div className="flex items-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
      />
      {label && <span className="ml-2 text-sm text-gray-700">{label}</span>}
    </div>
  );
};

interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
}

export const Switch: React.FC<SwitchProps> = ({ checked, onChange, disabled = false, label }) => {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input 
        type="checkbox" 
        checked={checked} 
        onChange={onChange} 
        disabled={disabled}
        className="sr-only"
      />
      <div className={`w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-300 
                        ${checked ? 'after:translate-x-5 bg-blue-600' : 'after:translate-x-0'} 
                        after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white
                        after:rounded-full after:h-5 after:w-5 after:transition-all 
                        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      ></div>
      {label && <span className="ml-3 text-sm font-medium text-gray-700">{label}</span>}
    </label>
  );
};

interface SliderProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

export const Slider: React.FC<SliderProps> = ({ 
  min, max, step, value, onChange, disabled = false, className = ''
}) => {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      disabled={disabled}
      className={`w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer ${className}`}
    />
  );
}; 