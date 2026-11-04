export function SetupScreen() {
  return (
    <main className="mx-auto max-w-xl px-5 py-10 safe-top">
      <h1 className="display text-4xl font-bold">Almost ready</h1>
      <p className="mt-3 text-mute leading-relaxed">City Manhunt needs a Supabase project for accounts, the database and live sync. It’s free and takes about five minutes.</p>
      <ol className="mt-6 space-y-4 text-[15px] leading-relaxed">
        <li className="panel p-4"><b>1. Create a project</b> at supabase.com (choose the Sydney region for the lowest lag).</li>
        <li className="panel p-4"><b>2. Run the schema.</b> Open SQL Editor › New query, paste all of <code className="text-voltsoft">supabase/schema.sql</code> and press Run.</li>
        <li className="panel p-4"><b>3. Turn on anonymous sign-ins.</b> Authentication › Sign In / Providers › “Allow anonymous sign-ins”.</li>
        <li className="panel p-4"><b>4. Add your keys.</b> Copy <code className="text-voltsoft">.env.example</code> to <code className="text-voltsoft">.env.local</code> and paste the Project URL and anon public key from Project Settings › API. On Vercel or Netlify, add the same two variables in the site settings.</li>
        <li className="panel p-4"><b>5. Restart</b> <code className="text-voltsoft">npm run dev</code> or redeploy.</li>
      </ol>
    </main>
  );
}
