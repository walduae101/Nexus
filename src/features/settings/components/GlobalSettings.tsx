import { useState, lazy, Suspense } from 'react';
import { Sheet, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';

const GlobalSettingsBody = lazy(() =>
  import('./GlobalSettingsBody').then(m => ({ default: m.GlobalSettingsBody }))
);

export function GlobalSettings() {
  const [open, setOpen] = useState(false);
  const [hasBeenOpened, setHasBeenOpened] = useState(false);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (v && !hasBeenOpened) setHasBeenOpened(true);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" />}>
        <Settings className="w-5 h-5" />
      </SheetTrigger>
      {hasBeenOpened && (
        <Suspense fallback={null}>
          <GlobalSettingsBody />
        </Suspense>
      )}
    </Sheet>
  );
}
