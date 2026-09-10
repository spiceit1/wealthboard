"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function PrivacyControls() {
 const [confirm,setConfirm]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
 return <form className="space-y-3 rounded border p-4" onSubmit={async e=>{e.preventDefault();setBusy(true);try {const r=await fetch('/api/privacy',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({confirmation:confirm})});const d=await r.json();setMessage(d.message);if(r.ok)setConfirm('');}catch{setMessage('Deletion did not complete. Please try again.');}finally{setBusy(false);}}}><p className="text-sm">You must be signed in with authenticator verification. Type DELETE MY DATA to confirm permanent removal of your financial records from this app.</p><input className="w-full rounded border p-2" aria-label="Deletion confirmation" value={confirm} onChange={e=>setConfirm(e.target.value)}/><Button variant="destructive" disabled={busy || confirm !== 'DELETE MY DATA'}>{busy?'Deleting…':'Disconnect Plaid and delete financial data'}</Button>{message && <p role="status">{message}</p>}</form>;
}
