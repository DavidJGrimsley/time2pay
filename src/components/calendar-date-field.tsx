import DateTimePicker, { type DateType } from 'react-native-ui-datepicker';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

type CalendarDateFieldProps = {
  label: string;
  value: string;
  onChange: (nextDate: string) => void;
};

function toLocalDatePart(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDateFromDateType(date: DateType): Date | null {
  if (!date) {
    return null;
  }

  if (date instanceof Date) {
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
    const next = date.toDate();
    return Number.isNaN(next.getTime()) ? null : next;
  }

  if (typeof date === 'string' || typeof date === 'number') {
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function parseLocalDate(datePart: string): Date {
  const parsed = new Date(`${datePart}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

export function CalendarDateField({ label, value, onChange }: CalendarDateFieldProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = useMemo(() => parseLocalDate(value), [value]);

  return (
    <View className="gap-2">
      <Text className="text-xs uppercase tracking-wide text-muted">{label}</Text>
      <Pressable
        className="rounded-md border border-border bg-background px-3 py-2"
        onPress={() => setOpen((current) => !current)}
      >
        <Text className="text-foreground">{selectedDate.toLocaleDateString()}</Text>
      </Pressable>

      {open ? (
        <View className="gap-2 rounded-md border border-border bg-background p-2">
          <DateTimePicker
            mode="single"
            date={selectedDate}
            onChange={({ date }) => {
              const next = toDateFromDateType(date);
              if (!next) {
                return;
              }
              onChange(toLocalDatePart(next));
              setOpen(false);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
