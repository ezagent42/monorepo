'use client';

import type { RoomMember, SocialwareApp } from '@/types';

interface RoleMatrixProps {
  members: RoomMember[];
  apps: SocialwareApp[];
}

export function RoleMatrix({ members, apps }: RoleMatrixProps) {
  const allRoles = apps.flatMap((a) => (a.roles ?? []).map((r) => ({ app: a.name, role: r })));

  if (allRoles.length === 0) {
    return <p className="text-sm text-muted-foreground">No Socialware roles defined.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 pr-4 font-medium">Member</th>
            {allRoles.map((r) => (
              <th key={`${r.app}:${r.role}`} className="px-2 py-2 text-center font-medium text-xs">
                {r.role}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.entity_id} className="border-b">
              <td className="py-2 pr-4">{m.display_name}</td>
              {allRoles.map((r) => (
                <td key={`${m.entity_id}:${r.app}:${r.role}`} className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={m.roles.includes(r.role)}
                    onChange={() => { /* TODO: role assignment API not yet available */ }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
