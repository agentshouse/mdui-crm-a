import { CustomRoutes, memoryStore, Resource } from 'ra-core';
import { useMemo } from 'react';
import { Route } from 'react-router';
import type { QueryClient } from '@tanstack/react-query';
import { Admin } from '@/components/admin/admin';
import { useIsMobile } from '@/hooks/use-mobile';
import companies from '../companies';
import contacts from '../contacts';
import deals from '../deals';
import { Dashboard } from '../dashboard/Dashboard';
import { MobileDashboard } from '../dashboard/MobileDashboard';
import { Layout } from '../layout/Layout';
import { MobileLayout } from '../layout/MobileLayout';
import { SettingsPage } from '../settings/SettingsPage';
import { i18nProvider } from '../providers/commons/i18nProvider';
import type { CrmDataProvider } from '../providers/types';
import { MobileTasksList } from '../tasks/MobileTasksList';
import { ContactListMobile } from '../contacts/ContactList';
import { ContactShow } from '../contacts/ContactShow';
import { NoteShowPage } from '../notes/NoteShowPage';

/** Original CRM resources, with House handling access outside the App. */
export const CRM = ({dataProvider,queryClient}:{dataProvider:CrmDataProvider;queryClient:QueryClient}) => {
  const mobile = useIsMobile();
  const store = useMemo(() => memoryStore(), []);
  return <Admin dataProvider={dataProvider} queryClient={queryClient} i18nProvider={i18nProvider} store={store} layout={mobile?MobileLayout:Layout} dashboard={mobile?MobileDashboard:Dashboard} title="CRM" disableTelemetry>
    <CustomRoutes><Route path="/settings" element={<SettingsPage/>}/></CustomRoutes>
    <Resource name="contacts" {...contacts} {...(mobile?{list:ContactListMobile,show:ContactShow}:{})}><Route path=":id/notes/:noteId" element={<NoteShowPage/>}/></Resource>
    <Resource name="companies" {...companies}/><Resource name="deals" {...deals}/>
    <Resource name="tasks" list={MobileTasksList}/><Resource name="contact_notes"/><Resource name="deal_notes"/><Resource name="sales"/><Resource name="tags"/><Resource name="configuration"/>
  </Admin>;
};
