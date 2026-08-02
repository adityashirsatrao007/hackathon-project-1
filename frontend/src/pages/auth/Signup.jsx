import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { authApi } from "@/services/api/apiHandler";
import { useAuth } from "@/hooks/useAuth";
import { slugify } from "@/utils/helpers";

export default function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [formError, setFormError] = useState("");

  const signupMutation = useMutation({
    mutationFn: (data) => authApi.signup(data),
    onSuccess: (data) => {
      login(data.access_token, data.user);
      navigate("/dashboard", { replace: true });
    },
    onError: (err) => {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setFormError(detail.map((d) => d.msg).join(", "));
      } else {
        setFormError(detail || "Registration failed. Please try again.");
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.name || !form.email || !form.password) {
      setFormError("Please fill in all fields.");
      return;
    }
    if (form.password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    signupMutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-slate-100">Create an account</h2>
        <p className="text-sm text-slate-400">Start tracking errors in minutes</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {formError}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="signup-name" className="block text-sm font-medium text-slate-300">
            Full name
          </label>
          <input
            id="signup-name"
            type="text"
            autoComplete="name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Jane Smith"
            className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none ring-violet-500/50 transition focus:border-violet-500/50 focus:ring-2"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="signup-email" className="block text-sm font-medium text-slate-300">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none ring-violet-500/50 transition focus:border-violet-500/50 focus:ring-2"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="signup-password" className="block text-sm font-medium text-slate-300">
            Password
            <span className="ml-1 text-slate-500">(min 8 characters)</span>
          </label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPwd ? "text" : "password"}
              autoComplete="new-password"
              required
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 pr-12 text-sm text-slate-100 placeholder-slate-500 outline-none ring-violet-500/50 transition focus:border-violet-500/50 focus:ring-2"
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          id="btn-signup-submit"
          type="submit"
          disabled={signupMutation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors disabled:opacity-60"
        >
          {signupMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Create account
        </button>
      </form>

      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-violet-400 hover:text-violet-300 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
