import { ScrollView, Text, View } from 'react-native';
import { CustomersListScreen } from './customers/customers-list-screen';
import { ProjectsOverview } from '@/components/projects-overview';

export function CustomersProjectsScreen() {
  return (
    <ScrollView contentContainerClassName="gap-6 pb-10">
      <View className="gap-1">
        <Text className="text-3xl font-extrabold text-heading">Customers &amp; Projects</Text>
        <Text className="text-muted">Manage who you work with and the projects you deliver for them.</Text>
      </View>
      <View className="gap-6 lg:flex-row">
        <View className="flex-1">
          <CustomersListScreen />
        </View>
        <View className="flex-[2]">
          <ProjectsOverview />
        </View>
      </View>
    </ScrollView>
  );
}
