import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Sparkles, Smile, Meh, Frown, TrendingDown, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { useBudget } from "@/hooks/use-budget";

type MoodType = 'great' | 'good' | 'okay' | 'bad';

interface DayMood {
  date: Date;
  mood: MoodType;
  note?: string;
  spent: number;
  saved: number;
}

export default function BudgetMoodCalendar() {
  const [selectedDay, setSelectedDay] = useState<Date>();
  const { budgetStatus } = useBudget();
  const [moods, setMoods] = useState<DayMood[]>([]);

  const getMoodForDay = (day: Date): MoodType | undefined => {
    const dayMood = moods.find(
      m => format(m.date, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
    );
    return dayMood?.mood;
  };

  const getMoodIcon = (mood: MoodType) => {
    switch (mood) {
      case 'great':
        return <Sparkles className="h-5 w-5 text-yellow-500" />;
      case 'good':
        return <Smile className="h-5 w-5 text-green-500" />;
      case 'okay':
        return <Meh className="h-5 w-5 text-blue-500" />;
      case 'bad':
        return <Frown className="h-5 w-5 text-red-500" />;
    }
  };

  const handleDayClick = (day: Date) => {
    setSelectedDay(day);
    // For demo purposes, randomly assign a mood if not exists
    if (!getMoodForDay(day)) {
      const moods: MoodType[] = ['great', 'good', 'okay', 'bad'];
      const randomMood = moods[Math.floor(Math.random() * moods.length)];
      setMoods(prev => [...prev, {
        date: day,
        mood: randomMood,
        spent: Math.random() * 100,
        saved: Math.random() * 50
      }]);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Financial Wellness Calendar
          <div className="flex gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            <TrendingDown className="h-5 w-5 text-red-500" />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DayPicker
          mode="single"
          selected={selectedDay}
          onSelect={(day) => day && handleDayClick(day)}
          modifiers={{
            mood: (day) => !!getMoodForDay(day),
          }}
          modifiersStyles={{
            mood: {
              border: '2px solid var(--border)',
              borderRadius: '50%',
            },
          }}
          components={{
            DayContent: ({ date }) => {
              const mood = getMoodForDay(date);
              return (
                <div className="relative w-full h-full flex items-center justify-center">
                  {format(date, 'd')}
                  {mood && (
                    <AnimatePresence>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2"
                      >
                        {getMoodIcon(mood)}
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
              );
            },
          }}
          className={cn(
            "p-3",
            "rdp-day_selected:bg-primary rdp-day_selected:text-primary-foreground",
            "rdp-day_today:bg-accent rdp-day_today:text-accent-foreground"
          )}
        />

        {selectedDay && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 border rounded-lg"
          >
            <h3 className="font-semibold mb-2">
              {format(selectedDay, 'MMMM d, yyyy')}
            </h3>
            {moods.find(m => format(m.date, 'yyyy-MM-dd') === format(selectedDay, 'yyyy-MM-dd')) ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span>Spent: ${budgetStatus?.spent.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span>Saved: ${budgetStatus?.saved.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No data for this day</p>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
