    function BillingPage() {
      return (
        <div className="space-y-5 animate-enter">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><i className="fa-solid fa-file-invoice-dollar text-emerald-600" /></div>
              <div><h1 className="text-xl font-bold text-slate-900">Billing</h1><p className="text-xs text-slate-500">Invoices, payments, and subscription</p></div>
            </div>
            <Badge status="active">Account Active</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6 md:col-span-2 border-l-[3px] border-l-emerald-500" hover>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Current Invoice</div>
                  <div className="text-3xl font-bold text-slate-900 mt-2">{DASHBOARD.currentInvoice} <span className="text-lg font-normal text-slate-400">SYP</span></div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge status="draft">Draft</Badge>
                    <span className="text-xs text-slate-500">INV-2026-00005</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Cycle</div>
                  <div className="text-sm font-medium text-slate-900 mt-0.5">Jul 15 – Aug 14, 2026</div>
                  <div className="text-xs text-slate-500 mt-2">Days remaining</div>
                  <div className="text-sm font-bold text-emerald-600">{DASHBOARD.daysUntilBilling} days</div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex gap-6">
                <div><div className="text-xs text-slate-500">Fixed fee</div><div className="text-sm font-semibold text-slate-900">10 SYP</div></div>
                <div><div className="text-xs text-slate-500">Reserved volume</div><div className="text-sm font-semibold text-slate-900">100 CBM</div></div>
                <div><div className="text-xs text-slate-500">Reserved weight</div><div className="text-sm font-semibold text-slate-900">100 kg</div></div>
                <div><div className="text-xs text-slate-500">Cycle length</div><div className="text-sm font-semibold text-slate-900">30 days</div></div>
              </div>
            </Card>

            <Card className="p-6" hover>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-4">Payment Summary</div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Total invoices</span><span className="font-semibold text-slate-900">2</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Paid</span><span className="font-semibold text-emerald-600">0</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Outstanding</span><span className="font-semibold text-rose-600">20 SYP</span></div>
              </div>
              <button className="w-full mt-5 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">Download statement</button>
            </Card>
          </div>

          <Card className="p-6">
            <h3 className="font-semibold text-slate-900 mb-1">Billing Trend</h3>
            <p className="text-xs text-slate-500 mb-6">Invoice amounts over the last 6 months</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={BILLING_TREND}>
                  <defs><linearGradient id="billGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10B981" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill:'#64748B',fontSize:12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill:'#64748B',fontSize:12}} />
                  <Tooltip contentStyle={{borderRadius:10,border:'1px solid #E2E8F0',boxShadow:'0 10px 15px -3px rgb(0 0 0 / 0.05)'}} />
                  <Area type="monotone" dataKey="amount" stroke="#10B981" strokeWidth={2} fill="url(#billGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div><h3 className="font-semibold text-slate-900">Invoice History</h3><p className="text-xs text-slate-500 mt-0.5">All invoices and payment status</p></div>
              <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">Export CSV</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 text-xs uppercase text-slate-500 font-semibold">
                  <tr><th className="px-5 py-3 text-left">Invoice #</th><th className="px-5 py-3 text-left">Cycle</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3 text-left">Status</th><th className="px-5 py-3 text-left">Issued</th><th className="px-5 py-3 text-left">Created</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {INVOICES.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{inv.id}</td>
                      <td className="px-5 py-3.5 text-slate-600 text-xs">{inv.cycle}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-slate-900">{inv.amount} SYP</td>
                      <td className="px-5 py-3.5"><Badge status={inv.status.toLowerCase()} /></td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">{inv.issued || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">{inv.created}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      );
    }

    /* ─── NOTIFICATIONS ─── */
