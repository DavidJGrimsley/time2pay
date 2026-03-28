import { ScrollView, Text, View } from 'react-native';

type PublicLegalDocumentProps = {
  title: string;
  lastUpdated: string;
  sections: Array<{
    heading: string;
    body: string[];
  }>;
};

export function PublicLegalDocument({ title, lastUpdated, sections }: PublicLegalDocumentProps) {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ paddingBottom: 48 }}>
      <View className="mx-auto w-full max-w-[920px] gap-6 px-6 py-10 md:px-8">
        <View className="gap-2">
          <Text className="text-xs font-bold uppercase tracking-[2px] text-muted">Time2Pay Legal</Text>
          <Text className="text-3xl font-bold text-heading md:text-4xl">{title}</Text>
          <Text className="text-sm text-muted">Last updated: {lastUpdated}</Text>
        </View>

        {sections.map((section) => (
          <View key={section.heading} className="gap-3 rounded-3xl border border-border bg-card p-5 md:p-6">
            <Text className="text-xl font-semibold text-heading">{section.heading}</Text>
            <View className="gap-3">
              {section.body.map((paragraph) => (
                <Text key={paragraph} className="text-base leading-7 text-foreground">
                  {paragraph}
                </Text>
              ))}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
