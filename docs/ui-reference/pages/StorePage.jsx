    function StorePage({ subtab, onNavigate }) {
      const tabs = [
        { id: 'online-orders', label: 'Online orders' },
        { id: 'cod', label: 'Cash on delivery' },
        { id: 'returns', label: 'Returns' }
      ];
      const renderContent = () => {
        if (subtab === 'online-orders') {
          return ONLINE.length === 0 ? <EmptyState type="online" onAction={()=>{}} /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 text-xs uppercase text-slate-500 font-semibold">
                  <tr><th className="px-5 py-3 text-left">Order #</th><th className="px-5 py-3 text-left">Status</th><th className="px-5 py-3 text-left">Recipient</th><th className="px-5 py-3 text-left">Channel</th><th className="px-5 py-3 text-left">Total</th><th className="px-5 py-3 text-right">Created</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ONLINE.map(o => (
                    <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{o.id}</td>
                      <td className="px-5 py-3.5"><Badge status={o.status} /></td>
                      <td className="px-5 py-3.5 text-slate-600">{o.recipient}</td>
                      <td className="px-5 py-3.5 text-slate-600">{o.channel}</td>
                      <td className="px-5 py-3.5 font-medium text-slate-900">{o.total}</td>
                      <td className="px-5 py-3.5 text-right text-slate-500 text-xs">{o.created}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (subtab === 'cod') {
          return <EmptyState type="cod" onAction={() => {}} />;
        }
        return <EmptyState type="returns" onAction={() => {}} />;
      };
      return (
        <div className="space-y-5 animate-enter">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><i className="fa-solid fa-store text-emerald-600" /></div>
              <div><h1 className="text-xl font-bold text-slate-900">Store Orders</h1><p className="text-xs text-slate-500">Online, COD, and returns</p></div>
            </div>
            {subtab === 'online-orders' && <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 flex items-center gap-2"><i className="fa-solid fa-plus text-xs" /> Create order</button>}
          </div>
          <div className="flex gap-1 p-1 bg-slate-100/60 rounded-xl w-fit">
            {tabs.map(t => (
              <button key={t.id} onClick={() => onNavigate(t.id)} className={cx('px-4 py-2 rounded-lg text-sm font-medium transition-all', subtab===t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                {t.label}
              </button>
            ))}
          </div>
          <Card className="overflow-hidden">{renderContent()}</Card>
        </div>
      );
    }

