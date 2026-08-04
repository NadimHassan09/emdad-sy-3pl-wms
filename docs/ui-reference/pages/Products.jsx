    function ProductsPage() {
      const [detail, setDetail] = useState(null);
      return (
        <div className="space-y-5 animate-enter">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><i className="fa-solid fa-boxes-stacked text-emerald-600" /></div>
              <div><h1 className="text-xl font-bold text-slate-900">Products</h1><p className="text-xs text-slate-500">Manage your product catalog and inventory</p></div>
            </div>
            <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 flex items-center gap-2"><i className="fa-solid fa-plus text-xs" /> New product</button>
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 text-xs uppercase text-slate-500 font-semibold">
                  <tr><th className="px-5 py-3 text-left">Product</th><th className="px-5 py-3 text-left">SKU</th><th className="px-5 py-3 text-left">Stock</th><th className="px-5 py-3 text-left">Status</th><th className="px-5 py-3 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {PRODUCTS.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400"><i className="fa-solid fa-box text-xs" /></div>
                          <div><div className="font-semibold text-slate-900">{p.name}</div><div className="text-xs text-slate-500">{p.description}</div></div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 font-mono text-xs">{p.sku}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{width: `${Math.min(100, (p.stockOnHand/10)*100)}%`}} /></div>
                          <span className="text-xs font-medium text-slate-700">{p.stockOnHand}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5"><Badge status={p.status} /></td>
                      <td className="px-5 py-3.5 text-right">
                        <button onClick={() => setDetail(p)} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 mr-3">View</button>
                        <button className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors inline-flex items-center justify-center"><i className="fa-solid fa-ellipsis" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {detail && <ProductDrawer product={detail} onClose={() => setDetail(null)} />}
        </div>
      );
    }

    function ProductDrawer({ product, onClose }) {
      const sections = [
        { title: 'General', fields: [['Name', product.name], ['SKU', product.sku], ['Barcode', product.barcode], ['UOM', product.uom], ['Description', product.description]] },
        { title: 'Inventory', fields: [['Stock on hand', product.stockOnHand], ['Committed stock', product.committedStock], ['Available for sale', product.availableForSale], ['Total inbound', product.totalInbound], ['Total outbound', product.totalOutbound]] },
        { title: 'Dimensions', fields: [['Length', product.length], ['Width', product.width], ['Height', product.height], ['Weight', product.weight], ['Volume (CBM)', product.volume]] },
        { title: 'Audit', fields: [['Created', product.created], ['Last updated', product.updated]] }
      ];
      return (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={onClose} />
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl overflow-y-auto animate-enter">
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Product details</h2>
                <p className="text-xs text-slate-500">{product.name}</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"><i className="fa-solid fa-xmark" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 text-xl"><i className="fa-solid fa-box" /></div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{product.name}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">{product.sku}</div>
                </div>
                <Badge status={product.status} />
              </div>
              {sections.map(sec => (
                <div key={sec.title}>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{sec.title}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {sec.fields.map(([label, value]) => (
                      <div key={label} className="p-3 bg-slate-50/60 rounded-lg border border-slate-100">
                        <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{label}</div>
                        <div className="text-sm font-semibold text-slate-900 mt-0.5">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    /* ─── BILLING ─── */
