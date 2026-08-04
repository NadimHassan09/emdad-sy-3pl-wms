    function NotificationsPage() {
      const [tab, setTab] = useState('all');
      const [items, setItems] = useState(NOTIFICATIONS);
      const filtered = items.filter(n => tab==='all' ? true : tab==='unread' ? !n.read : n.read);
      const markAll = () => setItems(prev => prev.map(n => ({ ...n, read: true })));
      const toggleRead = (id) => setItems(prev => prev.map(n => n.id===id ? { ...n, read: !n.read } : n));
      const unreadCount = items.filter(n => !n.read).length;
      const typeIcon = (t) => t==='order' ? 'fa-box' : 'fa-file-invoice';
      const typeColor = (t) => t==='order' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600';
      return (
        <div className="space-y-5 animate-enter max-w-4xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><i className="fa-solid fa-bell text-emerald-600" /></div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Notifications</h1>
                <p className="text-xs text-slate-500">You have <span className="font-semibold text-emerald-600">{unreadCount}</span> unread notifications</p>
              </div>
            </div>
            <button onClick={markAll} className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2">
              <i className="fa-solid fa-check-double text-xs" /> Mark all read
            </button>
          </div>

          <div className="flex gap-1 p-1 bg-slate-100/60 rounded-xl w-fit">
            {[{id:'all',label:'All'},{id:'unread',label:'Unread'},{id:'read',label:'Read'}].map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)} className={cx('px-4 py-2 rounded-lg text-sm font-medium transition-all', tab===t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                {t.label} {t.id==='unread' && unreadCount>0 ? <span className="ml-1 bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{unreadCount}</span> : null}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filtered.map(n => (
              <div key={n.id} onClick={() => toggleRead(n.id)} className={cx('group flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer', n.read ? 'bg-white border-slate-200/60 hover:border-slate-300' : 'bg-emerald-50/30 border-emerald-200/40 hover:bg-emerald-50/50')}>
                <div className={cx('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', typeColor(n.type))}>
                  <i className={cx('fa-solid', typeIcon(n.type))} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={cx('text-sm font-semibold', n.read ? 'text-slate-700' : 'text-slate-900')}>{n.title}</h3>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
                  <p className="text-xs text-slate-400 mt-2 font-medium">{n.date}</p>
                </div>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 rounded-lg hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-600">
                  <i className={cx('fa-solid', n.read ? 'fa-envelope-open' : 'fa-envelope')} />
                </button>
              </div>
            ))}
          </div>
        </div>
      );
    }

    /* ─── PROFILE ─── */
