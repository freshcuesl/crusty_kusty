import { Admin, Resource } from 'react-admin';
import { AdminLayout } from './AdminLayout';
import { adminDarkTheme, adminTheme } from './adminTheme';
import { Dashboard } from './Dashboard';
import { dataProvider } from './dataProvider';

export function AdminApp() {
  return (
    <Admin
      title="Crusty Krustees Admin"
      dataProvider={dataProvider}
      dashboard={Dashboard}
      layout={AdminLayout}
      theme={adminTheme}
      darkTheme={adminDarkTheme}
      disableTelemetry
    >
      {/* Screens for each resource arrive with the verification branch. */}
      <Resource name="businesses" options={{ label: 'Business verifications' }} />
    </Admin>
  );
}
