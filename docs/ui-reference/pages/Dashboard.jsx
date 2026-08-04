    function Dashboard({ onNavigate }) {
      const recentOrders = [...INBOUND.slice(0,3), ...OUTBOUND.slice(0,2)].map((o,i) => ({ ...o, type: o.id.startsWith('INB') ? 'Inbound' : 'Outbound' }));
      return (
        <div className="space-y-6 animate-enter">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
              <p className="text-slate-500 mt-1 text-sm">Welcome back, <span className="font-medium text-slate-700">{USER.name}</span></p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onNavigate('inbound')} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center gap-2">
                <i className="fa-solid fa-arrow-down text-emerald-600 text-xs" /> New inbound
              </button>
              <button onClick={() => onNavigate('outbound')} className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center gap-2">
                <i className="fa-solid fa-arrow-up text-blue-600 text-xs" /> New outbound
              </button>
              <button onClick={() => onNavigate('products')} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2">
                <i className="fa-solid fa-plus text-xs" /> Create
              </button>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-12 gap-4">
            <Card className="col-span-12 md:col-span-6 lg:col-span-4 p-6 relative overflow-hidden" hover>
              <div className="absolute top-0 right-0 p-6 opacity-[0.03]"><i className="fa-solid fa-warehouse text-8xl" /></div>
              <div className="relative">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-4">
                  <div className="w-6 h-6 rounded-md bg-emerald-50 flex items-center justify-center"><i className="fa-solid fa-chart-pie text-emerald-600 text-xs" /></div>
                  Storage Utilization
                </div>
                <div className="flex items-center gap-5">
                  <div className="relative w-20 h-20">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#E2E8F0" strokeWidth="3" />
                      <path className="ring-progress" strokeDasharray={`${DASHBOARD.storageUsed}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center"><span className="text-lg font-bold text-slate-900">{DASHBOARD.storageUsed}%</span></div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{DASHBOARD.storageUsed} <span className="text-sm font-medium text-slate-400">/ {DASHBOARD.storageTotal} CBM</span></div>
                    <div className="text-xs text-slate-500 mt-1">Reserved volume: <span className="font-semibold text-slate-700">{DASHBOARD.reservedVolume} CBM</span></div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="col-span-6 md:col-span-3 lg:col-span-2 p-6" hover>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-4">
                <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center"><i className="fa-solid fa-box-open text-blue-600 text-xs" /></div>
                Active Orders
              </div>
              <div className="text-3xl font-bold text-slate-900">{DASHBOARD.activeOrders}</div>
              <div className="text-xs text-slate-500 mt-1">Open inbound + outbound</div>
              <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                <i className="fa-solid fa-arrow-trend-up" /> On track
              </div>
            </Card>

            <Card className="col-span-6 md:col-span-3 lg:col-span-3 p-6" hover>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-4">
                <div className="w-6 h-6 rounded-md bg-amber-50 flex items-center justify-center"><i className="fa-solid fa-weight-hanging text-amber-600 text-xs" /></div>
                Reserved Weight
              </div>
              <div className="text-3xl font-bold text-slate-900">{DASHBOARD.reservedWeight} <span className="text-base font-medium text-slate-400">kg</span></div>
              <div className="mt-4 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{width: '65%'}} />
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] text-slate-400 font-medium"><span>0</span><span>200 kg</span></div>
            </Card>

            <Card className="col-span-12 md:col-span-6 lg:col-span-3 p-6 border-l-[3px] border-l-emerald-500" hover>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-4">
                <div className="w-6 h-6 rounded-md bg-emerald-50 flex items-center justify-center"><i className="fa-solid fa-calendar-day text-emerald-600 text-xs" /></div>
                Billing Cycle
              </div>
              <div className="text-3xl font-bold text-slate-900">{DASHBOARD.daysUntilBilling} <span className="text-base font-medium text-slate-400">days left</span></div>
              <div className="text-xs text-slate-500 mt-1">Current invoice: <span className="font-semibold text-slate-900">{DASHBOARD.currentInvoice}</span></div>
              <button onClick={() => onNavigate('billing')} className="mt-4 text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                View billing <i className="fa-solid fa-arrow-right text-[10px]" />
              </button>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-slate-900">Order Volume Trend</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Inbound vs outbound over the last 7 days</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Inbound</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> Outbound</span>
                </div>
              </div>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ORDER_TREND}>
                    <defs>
                      <linearGradient id="inboundGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.15}/><stop offset="95%" stopColor="#10B981" stopOpacity={0}/></linearGradient>
                      <linearGradient id="outboundGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15}/><stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#64748B',fontSize:12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill:'#64748B',fontSize:12}} />
                    <Tooltip contentStyle={{borderRadius:10,border:'1px solid #E2E8F0',boxShadow:'0 10px 15px -3px rgb(0 0 0 / 0.05)'}} />
                    <Area type="monotone" dataKey="inbound" stroke="#10B981" strokeWidth={2} fill="url(#inboundGrad)" />
                    <Area type="monotone" dataKey="outbound" stroke="#3B82F6" strokeWidth={2} fill="url(#outboundGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-slate-900 mb-1">Capacity Breakdown</h3>
              <p className="text-xs text-slate-500 mb-6">Reserved vs available storage</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={STORAGE_DATA} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">
                      {STORAGE_DATA.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 text-xs">
                <span className="flex items-center gap-1.5 text-slate-600"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Used</span>
                <span className="flex items-center gap-1.5 text-slate-600"><span className="w-2 h-2 rounded-full bg-slate-200" /> Free</span>
              </div>
            </Card>
          </div>

          {/* Bottom Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">Recent Orders</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Latest activity across all channels</p>
                </div>
                <button onClick={() => onNavigate('inbound')} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">View all</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/60 text-xs uppercase text-slate-500 font-semibold">
                    <tr><th className="px-5 py-3 text-left">Order #</th><th className="px-5 py-3 text-left">Status</th><th className="px-5 py-3 text-left">Type</th><th className="px-5 py-3 text-right">Created</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentOrders.map((o,i) => (
                      <tr key={i} className="hover:bg-slate-50/60 transition-colors group">
                        <td className="px-5 py-3 font-medium text-slate-900">{o.id}</td>
                        <td className="px-5 py-3"><Badge status={o.status} /></td>
                        <td className="px-5 py-3 text-slate-500 text-xs">{o.type}</td>
                        <td className="px-5 py-3 text-right text-slate-500 text-xs">{o.created}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">Recent Invoices</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Billing activity</p>
                </div>
                <button onClick={() => onNavigate('billing')} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">View all</button>
              </div>
              <div className="divide-y divide-slate-100">
                {INVOICES.map(inv => (
                  <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors group">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{inv.id}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{inv.cycle}</div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm font-bold text-slate-900">{inv.amount}</div>
                      <div className="mt-1"><Badge status={inv.status.toLowerCase()} /></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 bg-slate-50/50 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Next cycle ends</span>
                  <span className="font-semibold text-slate-700">Aug 14, 2026</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      );
    }

    /* ─── ORDERS PAGE (Inbound / Outbound) ─── */
