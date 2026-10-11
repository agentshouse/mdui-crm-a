import { CoreAdminRoutes, CoreAdminContext, DefaultTitleContextProvider, type CoreAdminProps, memoryStore } from 'ra-core';
import { ErrorBoundary } from 'react-error-boundary';
import { ThemeProvider } from '@/components/admin/theme-provider';
import { Error } from '@/components/admin/error';
import { NotFound } from '@/components/admin/not-found';
const defaultStore = memoryStore();
const Empty = () => null;
/** Donor admin shell with react-admin public route/context components.
 * The telemetry-bearing CoreAdminUI and service-auth routes are not mounted. */
export const Admin = ({children,dataProvider,i18nProvider,queryClient,store=defaultStore,layout,dashboard,title='CRM'}:CoreAdminProps) => (
 <CoreAdminContext dataProvider={dataProvider} i18nProvider={i18nProvider} queryClient={queryClient} store={store}>
  <ThemeProvider><DefaultTitleContextProvider value={title}><ErrorBoundary FallbackComponent={Error}><CoreAdminRoutes layout={layout!} dashboard={dashboard} catchAll={NotFound} loading={Empty} ready={Empty} requireAuth={false} authenticationError={Empty} accessDenied={Empty}>{children}</CoreAdminRoutes></ErrorBoundary></DefaultTitleContextProvider></ThemeProvider>
 </CoreAdminContext>
);
