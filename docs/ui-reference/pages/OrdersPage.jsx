    function OrdersPage({ type, onBack }) {
      const [filterStatus, setFilterStatus] = useState('all');
      const [search, setSearch] = useState('');
      const data = type === 'inbound' ? INBOUND : OUTBOUND;
      const filtered = data.filter(o => (filterStatus==='all' || o.status===filterStatus) && (search==='' || o.id.toLowerCase().includes(search.toLowerCase())));
      const title = type === 'inbound' ? 'Inbound Orders' : 'Outbound Orders';
      const icon = type === 'inbound' ? 'fa-arrow-down' : 'fa-arrow-up';
      return (
        <div className="space-y-5 animate-enter">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <i className={cx("fa-solid", icon, "text-emerald-600")} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{title}</h1>
                <p className="text-xs text-slate-500">Manage and track your {type} orders</p>
              </div>
            </div>
            <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2">
              <i className="fa-solid fa-plus text-xs" /> New {type}
            </button>
          </div>

          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-sm">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order number..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm input-premium" />
              </div>
              <div className="flex gap-2">
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 input-premium">
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="in progress">In Progress</option>
                  <option value="partially received">Partially Received</option>
                  <option value="shipped">Shipped</option>
                </select>
                <button className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2">
                  <i className="fa-solid fa-filter text-xs" /> Filters
                </button>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 text-xs uppercase text-slate-500 font-semibold">
                  <tr>
                    <th className="px-5 py-3 text-left w-10"><input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" /></th>
                    <th className="px-5 py-3 text-left">Order #</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-left">{type==='inbound' ? 'Expected Arrival' : 'Required Ship'}</th>
                    <th className="px-5 py-3 text-left">Lines</th>
                    <th className="px-5 py-3 text-right">Created</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(o => (
                    <tr key={o.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="px-5 py-3.5"><input type="checkbox" className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" /></td>
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{o.id}</td>
                      <td className="px-5 py-3.5"><Badge status={o.status} /></td>
                      <td className="px-5 py-3.5 text-slate-600">{o.arrival || o.requiredShip}</td>
                      <td className="px-5 py-3.5 text-slate-600">{o.lines}</td>
                      <td className="px-5 py-3.5 text-right text-slate-500 text-xs">{o.created}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center justify-center">
                          <i className="fa-solid fa-ellipsis" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Showing <span className="font-semibold text-slate-700">1-{filtered.length}</span> of <span className="font-semibold text-slate-700">{filtered.length}</span> results</span>
              <div className="flex gap-1">
                <button className="px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-400 cursor-not-allowed">Previous</button>
                <button className="px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-400 cursor-not-allowed">Next</button>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    /* ─── STORE PAGE (Online / COD / Returns) ─── */
