export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-soft text-white shadow-glow ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[58%] w-[58%]"
      >
        <circle cx="12" cy="5" r="2.4" />
        <circle cx="5" cy="18" r="2.4" />
        <circle cx="19" cy="18" r="2.4" />
        <path d="M12 7.4 6.6 15.8M12 7.4l5.4 8.4M7.4 18h9.2" />
      </svg>
    </span>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Logo className="h-8 w-8" />
      <span className="text-lg font-extrabold tracking-tight text-white">
        Code<span className="text-accent-soft">Atlas</span>
      </span>
    </div>
  );
}
