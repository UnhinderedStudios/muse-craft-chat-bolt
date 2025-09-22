import React from 'react';
import { ChromePicker } from 'react-color';
import { cn } from '@/lib/utils';
import { RotateCcw } from 'lucide-react';
import { Button } from './button';
import { useColorMemory } from '@/hooks/use-color-memory';

interface ColorWheelPickerProps {
  color: string;
  onChange: (color: string) => void;
  onApply: () => void;
  onReset: () => void;
  isApplied: boolean;
  className?: string;
}

export const ColorWheelPicker: React.FC<ColorWheelPickerProps> = ({
  color,
  onChange,
  onApply,
  onReset,
  isApplied,
  className
}) => {
  const { recentColors, addColor } = useColorMemory();

  const handleColorChange = (colorResult: any) => {
    onChange(colorResult.hex);
  };

  const handleApply = () => {
    if (color) {
      addColor(color);
      onApply();
    }
  };

  const handleMemoryColorClick = (memoryColor: string) => {
    onChange(memoryColor);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Compact Color Picker */}
      <div className="flex justify-center">
        <ChromePicker
          color={color || "#ffffff"}
          onChange={handleColorChange}
          disableAlpha
          styles={{
            default: {
              picker: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                width: '180px',
                boxShadow: 'none',
                fontFamily: 'inherit'
              },
              saturation: {
                borderRadius: '6px',
                height: '80px'
              },
              hue: {
                borderRadius: '4px',
                height: '10px'
              },
              input: {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '11px',
                padding: '2px 4px'
              },
              label: {
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '10px'
              }
            }
          }}
        />
      </div>

      {/* Recent Colors Memory */}
      {recentColors.length > 0 && (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1 justify-center">
            {recentColors.slice(0, 8).map((memoryColor, index) => (
              <button
                key={`${memoryColor}-${index}`}
                onClick={() => handleMemoryColorClick(memoryColor)}
                className={cn(
                  "w-5 h-5 rounded-full border transition-all hover:scale-110",
                  color === memoryColor 
                    ? "border-white ring-1 ring-white/40" 
                    : "border-white/30 hover:border-white/60"
                )}
                style={{ backgroundColor: memoryColor }}
                title={memoryColor}
              />
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={handleApply}
          disabled={!color}
          className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs px-3 py-1"
        >
          Apply
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs px-3 py-1"
        >
          <RotateCcw className="w-3 h-3 mr-1" />
          Reset
        </Button>
      </div>
      
      {/* Applied Status */}
      {isApplied && color && (
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-xs px-2 py-1 rounded">
            <div 
              className="w-3 h-3 rounded-full border border-white/20" 
              style={{ backgroundColor: color }}
            />
            {color.toUpperCase()}
          </div>
        </div>
      )}
    </div>
  );
};