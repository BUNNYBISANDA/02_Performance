import type { ReactNode } from "react";
import { DrawerProvider, useDrawer } from "../../lib/drawer-context";
import { CeodaDrawer } from "./CeodaDrawer";

function AppShellContent({ children }: { children: ReactNode }) {
  const { drawerOpen, closeDrawer } = useDrawer();

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f4f6fb]">
      <CeodaDrawer open={drawerOpen} onClose={closeDrawer} />
      {children}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <DrawerProvider>
      <AppShellContent>{children}</AppShellContent>
    </DrawerProvider>
  );
}
