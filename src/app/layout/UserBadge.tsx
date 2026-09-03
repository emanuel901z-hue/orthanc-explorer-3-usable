import { useState } from 'react';
import { LogOut, Shield, Info } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { AboutDialog } from './AboutDialog';
import { useAuth } from '@/app/providers/auth-context';

export function UserBadge() {
  const [aboutOpen, setAboutOpen] = useState(false);
  const { user, signOut } = useAuth();

  if (!user) return null;

  const roleLabel = user.roles.includes('admin') ? 'Administrator' :
    user.roles.includes('physician') ? 'Physician' :
    user.roles.includes('technologist') ? 'Technologist' : 'Viewer';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-primary-foreground/10 transition-colors cursor-pointer focus:outline-none">
            <div className="h-7 w-7 rounded-full bg-primary-foreground/20 flex items-center justify-center text-[11px] font-semibold text-primary-foreground shrink-0">
              {user.initials}
            </div>
            <span className="text-xs font-medium text-primary-foreground/90 hidden sm:block">
              {user.displayName}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 z-50 bg-popover shadow-lg rounded-lg border">
          <DropdownMenuLabel className="font-normal pb-0">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                {user.initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user.displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          </DropdownMenuLabel>
          <div className="px-2 py-1.5">
            <Badge variant="outline" className="gap-1 text-[10px] h-5">
              <Shield className="h-3 w-3" />
              {roleLabel}
            </Badge>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onClick={() => setAboutOpen(true)}
          >
            <Info className="h-4 w-4" />
            About Orthanc Explorer 3
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 cursor-pointer text-destructive focus:text-destructive"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  );
}
