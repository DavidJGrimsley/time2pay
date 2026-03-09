import { Text, View } from 'react-native';

export type NoticeTone = 'neutral' | 'error' | 'success';

type InlineNoticeProps = {
  message: string;
  tone?: NoticeTone;
  className?: string;
  textClassName?: string;
};

const CONTAINER_CLASS_BY_TONE: Record<NoticeTone, string> = {
  neutral: '',
  error: 'rounded-md border border-danger/30 bg-danger/10 px-3 py-2',
  success: 'rounded-md border border-success/30 bg-success/10 px-3 py-2',
};

const TEXT_CLASS_BY_TONE: Record<NoticeTone, string> = {
  neutral: 'text-sm text-muted',
  error: 'text-sm text-danger',
  success: 'text-sm text-success',
};

function joinClasses(...values: (string | undefined)[]): string {
  return values.filter((value) => value && value.trim()).join(' ');
}

export function InlineNotice({
  message,
  tone = 'neutral',
  className,
  textClassName,
}: InlineNoticeProps) {
  const trimmed = message.trim();
  if (!trimmed) {
    return null;
  }

  const containerClassName = joinClasses(CONTAINER_CLASS_BY_TONE[tone], className);
  const resolvedTextClassName = joinClasses(TEXT_CLASS_BY_TONE[tone], textClassName);

  if (!containerClassName) {
    return <Text className={resolvedTextClassName}>{trimmed}</Text>;
  }

  return (
    <View className={containerClassName}>
      <Text className={resolvedTextClassName}>{trimmed}</Text>
    </View>
  );
}
