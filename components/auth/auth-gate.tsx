"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { acceptInvite, getUser, refreshSession, onAuthChange, handleAuthCallback, login, logout, requestPasswordRecovery, signup, updateUser } from "@netlify/identity";
import { Button } from "@/components/ui/button";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [state, setState] = useState<"loading" | "login" | "mfa" | "ready" | "password">("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [invite, setInvite] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [setupKey, setSetupKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function check() {
    await refreshSession();
    await getUser();
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to check sign-in status.");
    const session = await response.json();
    if (session.authorized) { setState("ready"); return; }
    if (!session.signedIn) { setState("login"); return; }
    setState("mfa");
    const setup = await fetch("/api/auth/mfa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "setup" }) });
    const data = await setup.json();
    if (!setup.ok) throw new Error(data.message);
    setQr(data.qr ?? null); setSetupKey(data.secret ?? null);
  }
  useEffect(() => {
    const unsubscribe = onAuthChange(event => {
      if (event === "token_refresh") {
        void fetch("/api/auth/session", { cache: "no-store" }).catch(() => {});
      }
    });
    (async () => {
      try {
        const result = await handleAuthCallback();
        if (result?.type === "invite") { setInvite(result.token ?? null); setState("password"); return; }
        if (result?.type === "recovery") { setState("password"); return; }
        await check();
      } catch (error) { setMessage(error instanceof Error ? error.message : "Sign-in unavailable."); setState("login"); }
    })();
    return unsubscribe;
  }, []);
  async function perform(action: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  }
  if (path === "/privacy" || path === "/security") return <>{children}</>;
  if (state === "ready") return <><div className="mb-3 flex justify-end"><Button variant="outline" size="sm" onClick={() => perform(async () => { await fetch("/api/auth/session", {method:"DELETE"}); await logout(); window.location.href="/"; })}>Sign out</Button></div>{children}</>;
  if (state === "loading") return <p>Checking secure access…</p>;
  return <main className="mx-auto my-12 max-w-md space-y-5 rounded-xl border bg-card p-7 shadow-sm">
    <h1 className="text-2xl font-semibold">WealthBoard</h1>
    <p className="text-sm text-muted-foreground">Private financial dashboard. Access is restricted to the owner.</p>
    {state === "login" && <form className="space-y-3" onSubmit={event => {event.preventDefault(); perform(async () => { await login(email,password); await check(); });}}>
      <label className="block">Email<input className="mt-1 w-full rounded border p-2" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
      <label className="block">Password<input className="mt-1 w-full rounded border p-2" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
      <Button disabled={busy} type="submit">Sign in</Button>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy || !email || password.length < 8} onClick={()=>perform(async()=>{await signup(email,password);setMessage("Check your email to confirm your account, then sign in. Use at least 8 characters for your password.");})}>Create owner account</Button><Button type="button" variant="outline" disabled={busy || !email} onClick={()=>perform(async()=>{await requestPasswordRecovery(email);setMessage("Check your email for the password-reset link.");})}>Forgot password</Button></div>
      <p className="text-xs text-muted-foreground">For first-time setup, use your approved owner email and a password of at least 8 characters.</p>
    </form>}
    {state === "password" && <form className="space-y-3" onSubmit={e=>{e.preventDefault();perform(async()=>{if(invite) await acceptInvite(invite,password);else await updateUser({password});await check();});}}><label>New password<input type="password" autoComplete="new-password" className="w-full rounded border p-2" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required /></label><Button disabled={busy}>Save password</Button></form>}
    {state === "mfa" && <form className="space-y-3" onSubmit={e=>{e.preventDefault();perform(async()=>{const r=await fetch("/api/auth/mfa",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code, rememberDevice})});const d=await r.json();if(!r.ok)throw new Error(d.message);setQr(null);setSetupKey(null);await check();});}}>
      <h2 className="font-semibold">{qr ? "Set up your authenticator" : "Verify your identity"}</h2>
      {qr && <><p className="text-sm">Scan this with your authenticator app, then enter its six-digit code. Keep your authenticator backup in a safe place.</p>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={qr} alt="Authenticator setup QR code" width={220} height={220}/><details><summary>Enter setup key manually</summary><code className="break-all text-xs">{setupKey}</code></details></>}
      <label className="block">Authenticator code<input className="mt-1 w-full rounded border p-2" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value)} required /></label><Button disabled={busy}>Verify</Button>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rememberDevice} onChange={event => setRememberDevice(event.target.checked)} />Remember this device for 30 days</label>
      <p className="text-xs text-muted-foreground">Use this only on your own device. Otherwise, verification lasts eight hours. Signing out ends remembered access.</p>
    </form>}
    {message && <p role="status" className="text-sm">{message}</p>}
    <div className="flex gap-4 text-xs underline"><a href="/privacy">Privacy</a><a href="/security">Security</a></div>
  </main>;
}
