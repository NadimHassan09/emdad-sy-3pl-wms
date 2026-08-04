    function App() {
      const [page, setPage] = useState('dashboard');
      const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
      const [notifOpen, setNotifOpen] = useState(false);
      const [searchOpen, setSearchOpen] = useState(false);

      const navigate = (p) => { setPage(p); setNotifOpen(false); window.scrollTo(0,0); };

      const renderPage = () => {
        switch(page) {
          case 'dashboard': return <Dashboard onNavigate={navigate} />;
          case 'inbound': return <OrdersPage type="inbound" onBack={()=>navigate('dashboard')} />;
          case 'outbound': return <OrdersPage type="outbound" onBack={()=>navigate('dashboard')} />;
          case 'online-orders':
          case 'cod':
          case 'returns': return <StorePage subtab={page} onNavigate={navigate} />;
          case 'products': return <ProductsPage />;
          case 'billing': return <BillingPage />;
          case 'notifications': return <NotificationsPage />;
          case 'profile': return <ProfilePage />;
          default: return <Dashboard onNavigate={navigate} />;
        }
      };

      return (
        <div className="flex h-screen bg-slate-50">
          <Sidebar page={page} onNavigate={navigate} collapsed={sidebarCollapsed} onToggle={()=>setSidebarCollapsed(!sidebarCollapsed)} />
          <div className="flex-1 flex flex-col min-w-0">
            <TopBar onNavigate={navigate} notifOpen={notifOpen} setNotifOpen={setNotifOpen} searchOpen={searchOpen} setSearchOpen={setSearchOpen} />
            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
              <div className="max-w-7xl mx-auto">
                {renderPage()}
              </div>
            </main>
          </div>
          {notifOpen && <div className="fixed inset-0 z-40" onClick={()=>setNotifOpen(false)} />}
        </div>
      );
    }

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
</body>
