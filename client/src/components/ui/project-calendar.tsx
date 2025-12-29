import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Calendar as CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, isSameMonth, isSameDay, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { WorkItem } from "@shared/schema";

type ViewMode = 'month' | 'week';

interface ProjectCalendarProps {
  workItems: WorkItem[];
  projectId: number;
}

const typeColors = {
  STORY: 'bg-green-100 text-green-800',
  TASK: 'bg-gray-100 text-gray-800',
  BUG: 'bg-red-100 text-red-800',
};

export function ProjectCalendar({ workItems, projectId }: ProjectCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  
  // Filter work items to show only Story items for this project
  const filteredWorkItems = useMemo(() => {
    console.log('🗓️ Filtering project work items for inner calendar...', {
      totalItems: workItems.length,
      projectId
    });
    
    // Filter to only show Story items from this specific project
    const projectStoryItems = workItems.filter((item: any) => 
      item.projectId === projectId && item.type === 'STORY'
    );
    
    console.log('📋 Filtered to Stories only for this project:', {
      originalCount: workItems.length,
      filteredCount: projectStoryItems.length,
      storyCount: workItems.filter((item: any) => item.type === 'STORY').length
    });
    
    return projectStoryItems.map((item: any) => {
      const hasStartDate = item.startDate && isValid(parseISO(item.startDate));
      const hasEndDate = item.endDate && isValid(parseISO(item.endDate));
      
      // If no dates are set, use creation date as fallback for calendar display
      if (!hasStartDate && !hasEndDate) {
        const createdDate = item.createdAt ? parseISO(item.createdAt) : new Date();
        return {
          ...item,
          startDate: createdDate.toISOString(),
          endDate: createdDate.toISOString(),
          isUsingCreatedDate: true
        };
      }
      
      return item;
    }).filter((item: any) => {
      const hasStartDate = item.startDate && isValid(parseISO(item.startDate));
      const hasEndDate = item.endDate && isValid(parseISO(item.endDate));
      return hasStartDate || hasEndDate;
    });
  }, [workItems, projectId]);

  // Generate calendar days based on view mode
  const calendarDays = useMemo(() => {
    if (viewMode === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart);
      const calendarEnd = endOfWeek(monthEnd);
      
      const days = [];
      let day = calendarStart;
      
      while (day <= calendarEnd) {
        days.push(day);
        day = addDays(day, 1);
      }
      
      return days;
    } else {
      // Week view
      const weekStart = startOfWeek(currentDate);
      const days = [];
      
      for (let i = 0; i < 7; i++) {
        days.push(addDays(weekStart, i));
      }
      
      return days;
    }
  }, [currentDate, viewMode]);

  // Get work items for a specific date
  const getWorkItemsForDate = (date: Date) => {
    return filteredWorkItems.filter((item: any) => {
      const startDate = item.startDate ? parseISO(item.startDate) : null;
      const endDate = item.endDate ? parseISO(item.endDate) : null;
      
      if (startDate && endDate) {
        // Item spans multiple days
        return date >= startDate && date <= endDate;
      } else if (startDate) {
        // Only start date
        return isSameDay(date, startDate);
      } else if (endDate) {
        // Only end date
        return isSameDay(date, endDate);
      }
      
      return false;
    });
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    if (viewMode === 'month') {
      setCurrentDate(prev => addMonths(prev, direction === 'next' ? 1 : -1));
    } else {
      setCurrentDate(prev => addDays(prev, direction === 'next' ? 7 : -7));
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            📅 Project Calendar - Stories, Tasks & Bugs
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('month')}
              data-testid="button-month-view"
            >
              Month
            </Button>
            <Button
              variant={viewMode === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('week')}
              data-testid="button-week-view"
            >
              Week
            </Button>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateDate('prev')}
                data-testid="button-prev-period"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              
              <h2 className="text-xl font-semibold min-w-[200px] text-center">
                {format(currentDate, viewMode === 'month' ? 'MMMM yyyy' : 'MMM dd, yyyy')}
              </h2>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateDate('next')}
                data-testid="button-next-period"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
              data-testid="button-today"
            >
              Today
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className={cn(
          "grid gap-1",
          viewMode === 'month' ? "grid-cols-7" : "grid-cols-7"
        )}>
          {/* Day Headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-2 text-center font-semibold text-sm text-gray-600 border-b" data-testid={`header-${day.toLowerCase()}`}>
              {day}
            </div>
          ))}
          
          {/* Calendar Days */}
          {calendarDays.map((day, index) => {
            const dayWorkItems = getWorkItemsForDate(day);
            const isCurrentMonth = viewMode === 'week' || isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());
            
            return (
              <div
                key={index}
                className={cn(
                  "border border-gray-200 min-h-[120px] p-1",
                  !isCurrentMonth && "bg-gray-50 text-gray-400",
                  isToday && "bg-blue-50 border-blue-300"
                )}
                data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
              >
                <div className={cn(
                  "text-sm font-medium p-1",
                  isToday && "text-blue-600"
                )}>
                  {format(day, 'd')}
                </div>
                
                {/* Work Items */}
                <div className="space-y-1">
                  {dayWorkItems.slice(0, viewMode === 'month' ? 3 : 8).map((item: any) => (
                    <div
                      key={item.id}
                      className={cn(
                        "text-xs p-1 rounded text-center cursor-pointer hover:opacity-80 border",
                        typeColors[item.type as keyof typeof typeColors]
                      )}
                      title={`${item.externalId}: ${item.title}${item.isUsingCreatedDate ? ' (using creation date)' : ''}`}
                      data-testid={`work-item-${item.id}`}
                    >
                      <div className="font-medium truncate">{item.externalId}</div>
                      <div className="truncate">{item.title}</div>
                      {item.priority && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {item.priority}
                        </Badge>
                      )}
                    </div>
                  ))}
                  
                  {dayWorkItems.length > (viewMode === 'month' ? 3 : 8) && (
                    <div className="text-xs text-gray-500 text-center py-1">
                      +{dayWorkItems.length - (viewMode === 'month' ? 3 : 8)} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {filteredWorkItems.length === 0 && (
          <div className="text-center py-8 text-gray-500" data-testid="no-items-message">
            <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No Stories, Tasks, or Bugs found for this project</p>
            <p className="text-sm">Work items will appear here when they have dates assigned</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}