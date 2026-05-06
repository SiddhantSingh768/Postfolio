import { Zap } from 'lucide-react';
import { ThemeToggle } from '../../components/ui/ThemeToggle';

export const AuthLayout = ({ children }) => (
  <div className="min-h-screen bg-[var(--bg-primary)] flex">
    {/* Left panel — branding (hidden on mobile) */}
    <div className="hidden lg:flex lg:w-2/5 bg-neutral-950 dark:bg-neutral-900 flex-col justify-between p-10">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-white text-sm">Postfolio</span>
      </div>

      <div>
        <blockquote className="text-white text-xl font-medium leading-relaxed mb-6">
          "The professional layer between me and my clients. My invoices actually get paid on time now."
        </blockquote>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center">
            <span className="text-xs text-white font-medium">R</span>
          </div>
          <div>
            <p className="text-sm font-medium text-white">Rohan Mehta</p>
            <p className="text-xs text-neutral-400">Freelance Product Designer</p>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {[['500+', 'Freelancers'], ['₹2Cr+', 'Invoiced'], ['4.9', 'Rating']].map(([n, l]) => (
          <div key={l}>
            <p className="text-xl font-semibold text-white">{n}</p>
            <p className="text-xs text-neutral-400">{l}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Right panel — form */}
    <div className="flex-1 flex flex-col">
      {/* Mobile header */}
      <div className="flex items-center justify-between p-4 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-[var(--text-primary)] text-sm">Postfolio</span>
        </div>
        <ThemeToggle />
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-slide-up">
          {children}
        </div>
      </div>

      {/* Desktop theme toggle */}
      <div className="hidden lg:flex justify-end p-4">
        <ThemeToggle />
      </div>
    </div>
  </div>
);