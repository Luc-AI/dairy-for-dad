'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ImportActivitiesDialog from './ImportActivitiesDialog';

export default function ImportActivitiesButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="w-4 h-4 mr-1" />
        Import
      </Button>
      <ImportActivitiesDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
