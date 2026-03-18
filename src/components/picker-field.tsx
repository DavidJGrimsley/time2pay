import { Picker } from '@react-native-picker/picker';
import { Text, useColorScheme, View, type StyleProp, type ViewStyle } from 'react-native';

const EMPTY_PICKER_VALUE = '';

export type PickerFieldOption = {
  id: string;
  label: string;
};

type PickerControlItem = {
  label: string;
  value: string;
  tone?: 'default' | 'placeholder';
};

type PickerControlProps = {
  selectedValue: string;
  items: PickerControlItem[];
  disabled?: boolean;
  large?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  onValueChange: (value: string) => void;
};

export type PickerFieldProps = {
  label: string;
  value: string | null;
  options: PickerFieldOption[];
  placeholder: string;
  createValue?: string;
  createLabel?: string;
  showCreateOption?: boolean;
  disabled?: boolean;
  large?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  onSelect: (value: string | null) => void;
  onCreateNew?: () => void;
};

export function PickerControl({
  selectedValue,
  items,
  disabled = false,
  large = false,
  containerStyle,
  onValueChange,
}: PickerControlProps) {
  const isDark = useColorScheme() === 'dark';
  const pickerTextColor = isDark ? '#f8f7f3' : '#1a1f16';
  const pickerPlaceholderColor = isDark ? '#b8b7b2' : '#6f7868';
  const pickerSurfaceColor = isDark ? '#1a1f16' : '#f8f7f3';

  return (
    <View
      className={`overflow-hidden rounded-md border border-border bg-background ${disabled ? 'opacity-60' : ''}`}
      style={containerStyle}
    >
      <Picker
        enabled={!disabled}
        selectedValue={selectedValue}
        onValueChange={(itemValue) => onValueChange(String(itemValue ?? EMPTY_PICKER_VALUE))}
        dropdownIconColor={pickerTextColor}
        style={{
          width: '100%',
          color: pickerTextColor,
          backgroundColor: pickerSurfaceColor,
          fontSize: large ? 24 : 16,
          height: large ? 52 : 46,
        }}
      >
        {items.map((item) => {
          const itemColor = item.tone === 'placeholder' ? pickerPlaceholderColor : pickerTextColor;
          return (
            <Picker.Item
              key={item.value}
              label={item.label}
              value={item.value}
              color={itemColor}
              style={{ color: itemColor, backgroundColor: pickerSurfaceColor }}
            />
          );
        })}
      </Picker>
    </View>
  );
}

export function PickerField({
  label,
  value,
  options,
  placeholder,
  createValue,
  createLabel = '+ Create new',
  showCreateOption = true,
  disabled = false,
  large = false,
  containerStyle,
  onSelect,
  onCreateNew,
}: PickerFieldProps) {
  function handleValueChange(next: string): void {
    if (createValue && next === createValue) {
      onCreateNew?.();
      return;
    }
    onSelect(next || null);
  }

  const items: PickerControlItem[] = [
    { label: placeholder, value: EMPTY_PICKER_VALUE, tone: 'placeholder' },
    ...options.map((option) => ({ label: option.label, value: option.id })),
    ...(createValue && showCreateOption ? [{ label: createLabel, value: createValue }] : []),
  ];

  return (
    <View className="gap-2">
      <Text className={large ? 'text-sm uppercase tracking-wide text-muted' : 'text-xs uppercase tracking-wide text-muted'}>
        {label}
      </Text>
      <PickerControl
        selectedValue={value ?? EMPTY_PICKER_VALUE}
        items={items}
        disabled={disabled}
        large={large}
        containerStyle={containerStyle}
        onValueChange={handleValueChange}
      />
    </View>
  );
}
