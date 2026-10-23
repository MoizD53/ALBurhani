import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';
import { getKolkataDateString } from '../../lib/utils';

export interface DailyCalendarPickerProps {
  selectedDate: string | null; // 'YYYY-MM-DD'
  onSelectDate: (date: string | null) => void;
  activityMap: Map<string, number> | Record<string, number>; // date -> count
  label?: string;
  accentColor?: 'gold' | 'emerald';
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const DailyCalendarPicker: React.FC<DailyCalendarPickerProps> = ({
  selectedDate,
  onSelectDate,
  activityMap,
  label = 'Calendar',
  accentColor = 'gold',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const todayIst = useMemo(() => getKolkataDateString(Date.now()), []);

  // Current viewed month & year in calendar
  const initialYear = selectedDate ? parseInt(selectedDate.split('-')[0], 10) : parseInt(todayIst.split('-')[0], 10);
  const initialMonth = selectedDate ? parseInt(selectedDate.split('-')[1], 10) - 1 : parseInt(todayIst.split('-')[1], 10) - 1;

  const [viewYear, setViewYear] = useState<number>(initialYear);
  const [viewMonth, setViewMonth] = useState<number>(initialMonth);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  // Calendar days grid
  const daysInMonth = useMemo(() => {
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun, 1 = Mon ...
    return { totalDays, firstDayOfWeek };
  }, [viewYear, viewMonth]);

  const formatReadableDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return `${day} ${MONTH_NAMES[monthIndex]?.slice(0, 3)} ${year}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const getActivityCount = (dateStr: string): number => {
    if (activityMap instanceof Map) {
      return activityMap.get(dateStr) || 0;
    }
    return (activityMap as Record<string, number>)?.[dateStr] || 0;
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Calendar Trigger Button */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-xs cursor-pointer ${
            selectedDate
              ? 'bg-[#FBF7EE] border-[#C99A18] text-[#8C6D15] font-bold ring-2 ring-[#C99A18]/20'
              : 'bg-white border-[#E8DEC8] hover:border-[#C99A18]/60 text-stone-700 hover:text-stone-900 hover:bg-[#FAF8F5]'
          }`}
          title="Filter bills by business date"
        >
          <CalendarIcon className={`w-3.5 h-3.5 ${selectedDate ? 'text-[#B8860B]' : 'text-stone-500'}`} />
          <span>{selectedDate ? formatReadableDate(selectedDate) : label}</span>
        </button>

        {selectedDate && (
          <button
            type="button"
            onClick={() => onSelectDate(null)}
            className="p-1 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
            title="Clear date filter (View All Bills)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Modern Calendar Popover */}
      {isOpen && (
        <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 z-50 w-72 bg-white border border-[#E8DEC8] rounded-2xl shadow-xl p-3.5 animate-in fade-in zoom-in-95 duration-150 select-none">
          
          {/* Calendar Header with Navigation */}
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#F0EBE0]">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-[#FAF8F5] transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="font-bold text-xs text-stone-900 font-serif">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-[#FAF8F5] transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Labels (Sun to Sat) */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((wd, i) => (
              <span key={i} className="text-[10px] font-bold text-stone-400 uppercase py-0.5">
                {wd}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty slots for days before 1st of month */}
            {Array.from({ length: daysInMonth.firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8" />
            ))}

            {/* Actual Month Days */}
            {Array.from({ length: daysInMonth.totalDays }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isSelected = selectedDate === dateStr;
              const isToday = todayIst === dateStr;
              const activityCount = getActivityCount(dateStr);
              const hasActivity = activityCount > 0;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => {
                    onSelectDate(dateStr);
                    setIsOpen(false);
                  }}
                  className={`h-8 rounded-lg text-xs font-semibold flex flex-col items-center justify-center relative transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#B8860B] text-white font-bold shadow-xs'
                      : isToday
                      ? 'bg-amber-50 text-amber-900 font-bold border border-amber-300'
                      : 'text-stone-700 hover:bg-[#FAF8F5] hover:text-stone-900'
                  }`}
                  title={`${dayNum} ${MONTH_NAMES[viewMonth]} ${viewYear}${hasActivity ? ` (${activityCount} bills)` : ''}`}
                >
                  <span className="leading-none">{dayNum}</span>

                  {/* Subtle activity dot/indicator badge */}
                  {hasActivity && (
                    <span
                      className={`w-1 h-1 rounded-full mt-0.5 ${
                        isSelected ? 'bg-white' : 'bg-[#B8860B]'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Bottom Quick Action Bar */}
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#F0EBE0] text-[11px]">
            <button
              type="button"
              onClick={() => {
                onSelectDate(todayIst);
                setViewYear(parseInt(todayIst.split('-')[0], 10));
                setViewMonth(parseInt(todayIst.split('-')[1], 10) - 1);
                setIsOpen(false);
              }}
              className="px-2 py-1 rounded-md text-[#8C6D15] hover:bg-[#FAF8F5] font-semibold transition-colors flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-[#B8860B]" />
              <span>Jump to Today</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectDate(null);
                setIsOpen(false);
              }}
              className="px-2 py-1 rounded-md text-stone-500 hover:text-stone-800 hover:bg-stone-100 font-medium transition-colors"
            >
              All Dates
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
