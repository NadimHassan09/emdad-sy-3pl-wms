    function EmptyState({ type, onAction }) {
      const config = {
        online: { icon: 'fa-cart-shopping', title: 'No online orders yet', desc: 'Create an order from your store channel to track fulfillment here.', action: 'Create first order' },
        cod: { icon: 'fa-money-bill', title: 'No cash-on-delivery orders', desc: 'COD orders will appear here once they are processed.', action: 'Learn more' },
        returns: { icon: 'fa-rotate-left', title: 'No returns yet', desc: 'Returns appear here when delivered orders come back to the warehouse.', action: 'Return policy' }
      };
      const c = config[type];
      return (
        <div className="py-20 flex flex-col items-center justify-center text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
            <i className={cx("fa-solid", c.icon, "text-2xl text-slate-300")} />
          </div>
          <h3 className="text-base font-semibold text-slate-900">{c.title}</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-xs">{c.desc}</p>
          <button onClick={onAction} className="mt-5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20">
            {c.action}
          </button>
        </div>
      );
    }

    /* ─── PRODUCTS ─── */
