    function ProfilePage() {
      return (
        <div className="space-y-5 animate-enter max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><i className="fa-solid fa-user text-emerald-600" /></div>
            <div><h1 className="text-xl font-bold text-slate-900">Profile</h1><p className="text-xs text-slate-500">Your account and preferences</p></div>
          </div>

          <Card className="overflow-hidden">
            <div className="h-24 bg-slate-900 relative">
              <div className="absolute inset-0 opacity-20" style={{backgroundImage:'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize:'20px 20px'}} />
            </div>
            <div className="px-6 pb-6">
              <div className="relative -mt-10 mb-4 flex items-end justify-between">
                <div className="w-20 h-20 rounded-2xl bg-emerald-600 border-4 border-white shadow-lg flex items-center justify-center text-white text-2xl font-bold">{USER.avatar}</div>
                <button className="mb-1 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Edit profile</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100"><div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Name</div><div className="text-sm font-semibold text-slate-900 mt-0.5">{USER.name}</div></div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100"><div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Email</div><div className="text-sm font-semibold text-slate-900 mt-0.5">{USER.email}</div></div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100"><div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Role</div><div className="text-sm font-semibold text-slate-900 mt-0.5">{USER.role}</div></div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100"><div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Company</div><div className="text-sm font-semibold text-slate-900 mt-0.5">{USER.company}</div></div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="p-5 hover-lift cursor-pointer" hover>
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><i className="fa-solid fa-bell text-blue-600" /></div>
                <i className="fa-solid fa-arrow-right text-slate-300 text-xs" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mt-3">Notifications</h3>
              <p className="text-xs text-slate-500 mt-1">View and manage your notification preferences.</p>
            </Card>
            <Card className="p-5 hover-lift cursor-pointer" hover>
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><i className="fa-solid fa-file-invoice-dollar text-emerald-600" /></div>
                <i className="fa-solid fa-arrow-right text-slate-300 text-xs" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mt-3">Billing</h3>
              <p className="text-xs text-slate-500 mt-1">Review invoices, payments, and subscription.</p>
            </Card>
          </div>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-900">Need help?</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">Contact your warehouse account manager for access changes or billing questions.</p>
            <button className="mt-3 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors">Contact support</button>
          </Card>
        </div>
      );
    }

    /* ─── APP SHELL ─── */
