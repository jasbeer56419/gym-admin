import { ROLE_LABEL } from "../permissions";

export default function CollectedBy({ name, role }: { name?: string; role?: string }) {
  if (!name) return <span className="text-muted">—</span>;
  return (
    <>
      <p className="text-sm">{name}</p>
      {role && <p className="text-xs text-muted">{ROLE_LABEL[role] ?? role}</p>}
    </>
  );
}