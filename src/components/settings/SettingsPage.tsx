import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { User, CreditCard, Bell, Shield, Users, Brain, LifeBuoy, Settings as SettingsIcon } from 'lucide-react'
import { BillingPanel } from '@/components/settings/panels/BillingPanel'
import { AccountSettingsPanel } from '@/components/settings/account/AccountSettingsPanel'
import { ProfilesPanel } from '@/components/settings/panels/ProfilesPanel'
import { MemoryPanel } from '@/components/settings/panels/MemoryPanel'
import { NotificationsPanel } from '@/components/settings/panels/NotificationsPanel'
import { ContactSupportPanel } from '@/components/settings/panels/ContactSupportPanel'
import { DeleteAccountPanel } from '@/components/settings/panels/DeleteAccountPanel'
import DisplayNamePanel from '@/components/settings/panels/DisplayNamePanel'
import { VoiceSelectionPanel } from '@/components/settings/VoiceSelectionPanel'

export default function SettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-light text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Manage your account preferences and billing information.</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="account" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Account
          </TabsTrigger>
          <TabsTrigger value="profiles" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Profiles
          </TabsTrigger>
          <TabsTrigger value="memory" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Memory
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="support" className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4" />
            Support
          </TabsTrigger>
          <TabsTrigger value="delete" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Delete
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <DisplayNamePanel />
              <VoiceSelectionPanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <AccountSettingsPanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profiles">
          <Card>
            <CardHeader>
              <CardTitle>Profiles</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ProfilesPanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memory">
          <Card>
            <CardHeader>
              <CardTitle>Memory</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <MemoryPanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle>Billing Information</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <BillingPanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <NotificationsPanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="support">
          <Card>
            <CardHeader>
              <CardTitle>Contact Support</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ContactSupportPanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delete">
          <Card>
            <CardHeader>
              <CardTitle>Delete Account</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DeleteAccountPanel />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
