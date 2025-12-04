import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUserData } from '@/hooks/useUserData';
import { Loader, Check } from 'lucide-react';
import { toast } from 'sonner';

const DisplayNamePanel: React.FC = () => {
  const { profile, updateDisplayName, loading } = useUserData();
  const [newDisplayName, setNewDisplayName] = useState(profile?.display_name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {

    setSaving(true);
    try {
      const trimmed = newDisplayName.trim();
      const { error } = await updateDisplayName(trimmed);
      if (error) {
        toast.error('Failed to update display name');
      } else {
        toast.success('Display name updated successfully');
      }
    } catch {
      toast.error('Failed to update display name');
    } finally {
      setSaving(false);
    }
  };

  const handleBlurSave = async () => {
    if (newDisplayName.trim() !== (profile?.display_name || '')) {
      await handleSave();
    }
  };

  useEffect(() => {
    setNewDisplayName(profile?.display_name || '');
  }, [profile?.display_name]);

  if (loading) return null;

  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm text-gray-800">Update Name</span>
      <div className="flex items-center gap-2">
        <Label htmlFor="display-name" className="sr-only">Display Name</Label>
        <Input
          id="display-name"
          value={newDisplayName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewDisplayName(e.target.value)}
          onBlur={handleBlurSave}
          disabled={saving}
          className="h-9 rounded-full px-4 w-[220px]"
        />
        {newDisplayName.trim() !== (profile?.display_name || '') && (
          <Button onClick={handleSave} disabled={saving} className="h-9 rounded-full px-4">
            {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            <span className="ml-2">Save</span>
          </Button>
        )}
      </div>
    </div>
  );
};

export default DisplayNamePanel;
