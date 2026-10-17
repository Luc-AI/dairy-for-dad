'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { EllipsisVertical, LogOut, Monitor, Moon, Sun, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { APP_NAME } from '@/lib/app';
import { logout } from '../actions';
import ImportActivitiesDialog from './ImportActivitiesDialog';

export default function AppHeader() {
  const [importOpen, setImportOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <header className="flex items-center justify-between gap-3">
      <h1 className="text-2xl font-bold tracking-tight">{APP_NAME}</h1>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-11" aria-label="Menü">
            <EllipsisVertical className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem className="py-2.5" onSelect={() => setImportOpen(true)}>
            <Upload />
            Garmin-Daten importieren
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">Darstellung</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={setTheme}>
            <DropdownMenuRadioItem value="system" className="py-2.5">
              <Monitor /> Automatisch
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="light" className="py-2.5">
              <Sun /> Hell
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark" className="py-2.5">
              <Moon /> Dunkel
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="py-2.5" onSelect={() => void logout()}>
            <LogOut />
            Abmelden
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ImportActivitiesDialog open={importOpen} onOpenChange={setImportOpen} />
    </header>
  );
}
