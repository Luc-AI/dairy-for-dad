'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { parseFiles } from '@/lib/garmin-parse';
import type { Activity } from '@/lib/db';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type FileEntry = {
  name: string;
  size: number;
  error?: string;
};

type Phase = 'idle' | 'parsing' | 'preview' | 'importing' | 'error';

export default function ImportActivitiesDialog({ open, onOpenChange }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [parsed, setParsed] = useState<Activity[]>([]);
  const [skippedNoTimestamp, setSkippedNoTimestamp] = useState(0);
  const [newActivities, setNewActivities] = useState<Activity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const reset = useCallback(() => {
    setPhase('idle');
    setFiles([]);
    setParsed([]);
    setSkippedNoTimestamp(0);
    setNewActivities([]);
    setError(null);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) reset();
      onOpenChange(next);
    },
    [onOpenChange, reset]
  );

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    if (busyRef.current) return;
    busyRef.current = true;
    setPhase('parsing');
    setError(null);

    try {
      const entries: FileEntry[] = [];
      const bodies: string[] = [];

      for (const file of Array.from(fileList)) {
        const entry: FileEntry = { name: file.name, size: file.size };
        try {
          const text = await file.text();
          // Validate as JSON early so we can flag bad files individually.
          JSON.parse(text);
          bodies.push(text);
        } catch {
          entry.error = "Couldn't parse — not valid JSON.";
        }
        entries.push(entry);
      }
      setFiles(entries);

      if (bodies.length === 0) {
        setError("These files don't look like valid JSON.");
        setPhase('error');
        return;
      }

      let result;
      try {
        result = parseFiles(bodies);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to parse files.');
        setPhase('error');
        return;
      }

      if (result.activities.length === 0) {
        setError("These files don't look like Garmin summarized activity exports.");
        setPhase('error');
        return;
      }

      setParsed(result.activities);
      setSkippedNoTimestamp(result.skippedNoTimestamp);

      // Fetch existing ids for the diff
      try {
        const res = await fetch('/api/activities/ids', { cache: 'no-store' });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const existingIds = (await res.json()) as number[];
        const existing = new Set(existingIds);
        const fresh = result.activities.filter((a) => !existing.has(a.id));
        setNewActivities(fresh);
        setPhase('preview');
      } catch (e) {
        setError(
          e instanceof Error
            ? `Couldn't check existing activities: ${e.message}`
            : "Couldn't check existing activities."
        );
        setPhase('error');
      }
    } finally {
      busyRef.current = false;
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPhase('importing');
    setError(null);
    try {
      const res = await fetch('/api/activities/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activities: newActivities }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? `Server returned ${res.status}`);
      }
      const inserted: number = json.inserted ?? 0;
      toast.success(
        inserted === 1
          ? 'Imported 1 new activity.'
          : `Imported ${inserted} new activities.`
      );
      window.dispatchEvent(new CustomEvent('activities:changed'));
      handleOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
      setPhase('error');
    } finally {
      busyRef.current = false;
    }
  }, [newActivities, handleOpenChange]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const fmtSize = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
  };

  const previewSummary = useMemo(() => {
    if (phase !== 'preview') return null;
    const total = parsed.length;
    const fresh = newActivities.length;
    const dup = total - fresh;
    return { total, fresh, dup };
  }, [phase, parsed.length, newActivities.length]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Garmin activities</DialogTitle>
          <DialogDescription>
            Upload one or more <code>*_summarizedActivities.json</code> files from your Garmin export.
            New activities will be added; existing ones are left alone.
          </DialogDescription>
        </DialogHeader>

        <label
          htmlFor="garmin-files"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 px-6 py-10 cursor-pointer hover:bg-muted/50 transition"
        >
          <Upload className="w-6 h-6 text-muted-foreground" />
          <div className="text-sm text-muted-foreground text-center">
            Drop <code>*_summarizedActivities.json</code> files
            <br />or click to choose
          </div>
          <input
            id="garmin-files"
            type="file"
            accept=".json,application/json"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>

        {files.length > 0 && (
          <ul className="text-xs text-muted-foreground space-y-1">
            {files.map((f) => (
              <li key={f.name} className={f.error ? 'text-destructive' : ''}>
                {f.name} ({fmtSize(f.size)}){f.error ? ` — ${f.error}` : ''}
              </li>
            ))}
          </ul>
        )}

        {phase === 'parsing' && (
          <p className="text-sm text-muted-foreground">Reading files…</p>
        )}

        {previewSummary && (
          <div className="text-sm space-y-1">
            <p>
              Found <strong>{previewSummary.total.toLocaleString()}</strong> activities across {files.filter((f) => !f.error).length} file
              {files.filter((f) => !f.error).length === 1 ? '' : 's'}.
            </p>
            {previewSummary.fresh > 0 ? (
              <p>
                <strong>{previewSummary.fresh.toLocaleString()}</strong> new,{' '}
                {previewSummary.dup.toLocaleString()} already in your database.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Nothing to import — everything in these files is already in your database.
              </p>
            )}
            {skippedNoTimestamp > 0 && (
              <p className="text-xs text-muted-foreground">
                ({skippedNoTimestamp} skipped due to missing timestamp.)
              </p>
            )}
          </div>
        )}

        {phase === 'importing' && (
          <p className="text-sm text-muted-foreground">Importing…</p>
        )}

        {phase === 'error' && error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={phase === 'importing'}
          >
            {phase === 'preview' && newActivities.length > 0 ? 'Cancel' : 'Close'}
          </Button>
          {phase === 'preview' && newActivities.length > 0 && (
            <Button onClick={handleImport}>
              Import {newActivities.length}
            </Button>
          )}
          {phase === 'importing' && (
            <Button disabled>Importing…</Button>
          )}
          {phase === 'error' && parsed.length > 0 && newActivities.length > 0 && (
            <Button onClick={handleImport}>Retry</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
