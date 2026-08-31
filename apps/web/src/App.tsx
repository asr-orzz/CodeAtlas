import { AuthProvider, useAuth } from "./auth/AuthContext";
import { Logo } from "./components/Logo";
import { Dashboard } from "./pages/Dashboard";
import { Landing } from "./pages/Landing";

export function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}

function Root() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  return user ? <Dashboard /> : <Landing />;
}

function Splash() {
  return (
    <div className="aurora flex h-screen items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-4">
        <Logo className="h-14 w-14 animate-float" />
        <div className="h-1 w-32 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 animate-[shimmer_1.4s_linear_infinite] bg-gradient-to-r from-transparent via-accent-soft to-transparent" />
        </div>
      </div>
    </div>
  );
}
