'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Columns3, List } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ProjectViewTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/projects/${projectId}/board`, label: 'Board', Icon: Columns3 },
    { href: `/projects/${projectId}/list`, label: 'List', Icon: List },
  ];

  return (
    <nav className="flex items-center gap-1 text-sm">
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors',
              active
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
