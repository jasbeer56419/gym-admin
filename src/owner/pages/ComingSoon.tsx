import { Sparkles } from "lucide-react";

export default function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Module</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">{title}</h1>
      <div className="card mt-8 grid place-items-center p-16 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
          <Sparkles size={24} />
        </div>
        <p className="mt-5 font-display text-xl">Coming soon</p>
        <p className="mt-2 max-w-md text-sm text-muted">{description}</p>
      </div>
    </div>
  );
}