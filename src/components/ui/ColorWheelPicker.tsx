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
    <div className={cn("space-y-4", className)}>
      {/* Modern Color Wheel Container */}
      <div className="relative">
        <div className="bg-gradient-to-br from-card-alt/80 to-card/80 backdrop-blur-sm border border-border-main rounded-2xl p-6 shadow-[var(--shadow-card)]">
          <div className="flex justify-center">
            <div className="relative">
              <ChromePicker
                color={color || "#ffffff"}
                onChange={handleColorChange}
                disableAlpha
                styles={{
                  default: {
                    picker: {
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: '16px',
                      width: '240px',
                      boxShadow: 'none',
                      fontFamily: 'inherit'
                    },
                    saturation: {
                      borderRadius: '12px',
                      border: '1px solid hsl(var(--border-main) / 0.2)'
                    },
                    hue: {
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border-main) / 0.2)',
                      height: '12px'
                    },
                    alpha: {
                      display: 'none' // Hide alpha since we disabled it
                    },
                    input: {
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border-main))',
                      borderRadius: '6px',
                      color: 'hsl(var(--foreground))',
                      fontSize: '12px',
                      padding: '4px 6px'
                    },
                    label: {
                      color: 'hsl(var(--foreground))',
                      fontSize: '11px',
                      fontWeight: '500'
                    },
                    swatch: {
                      borderRadius: '8px',
                      border: '2px solid hsl(var(--border-main))'
                    }
                  }
                }}
              />
              
              {/* Hex display - only hex format */}
              <div className="mt-3 text-center">
                <div className="inline-flex items-center gap-2 bg-card/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-border-main">
                  <div 
                    className="w-4 h-4 rounded-full border-2 border-border-main" 
                    style={{ backgroundColor: color || '#ffffff' }}
                  />
                  <span className="text-xs font-mono text-foreground/80 uppercase">
                    {color || '#ffffff'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Colors Memory */}
      {recentColors.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-foreground/60 uppercase tracking-wide">
            Recent Colors
          </h4>
          <div className="flex flex-wrap gap-2">
            {recentColors.map((memoryColor, index) => (
              <button
                key={`${memoryColor}-${index}`}
                onClick={() => handleMemoryColorClick(memoryColor)}
                className={cn(
                  "w-8 h-8 rounded-full border-2 transition-all hover:scale-110 hover:shadow-lg",
                  color === memoryColor 
                    ? "border-accent-primary ring-2 ring-accent-primary/40" 
                    : "border-border-main hover:border-border-main/60"
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
          className="bg-gradient-to-r from-accent-primary to-accent-secondary text-white border-0 hover:shadow-lg transition-all"
        >
          Apply Color
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="bg-card border-border-main text-foreground hover:bg-card-alt"
        >
          <RotateCcw className="w-3 h-3 mr-1" />
          Reset
        </Button>
      </div>
      
      {/* Applied Status */}
      {isApplied && color && (
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-accent-primary/10 text-accent-primary text-xs px-3 py-1.5 rounded-lg border border-accent-primary/20">
            <div 
              className="w-3 h-3 rounded-full border border-accent-primary/40" 
              style={{ backgroundColor: color }}
            />
            Background Color Applied
          </div>
        </div>
      )}
    </div>
  );
};