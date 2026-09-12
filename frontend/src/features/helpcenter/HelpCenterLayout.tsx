import { Outlet, Link, useLocation } from 'react-router-dom';
import { Search, Book, FileText, HelpCircle, HardDrive } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function HelpCenterLayout() {
  const location = useLocation();
  const isHome = location.pathname === '/help-center';

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Hero Search Section */}
      <div className="bg-primary text-primary-foreground py-16 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight">How can we help you today?</h1>
          <p className="text-lg text-primary-foreground/80">Search our knowledge base or submit a service request.</p>
          
          <div className="relative max-w-2xl mx-auto mt-8">
            <Search className="absolute left-4 top-4 h-6 w-6 text-muted-foreground" />
            <Input 
              type="text" 
              placeholder="Search for articles, guides, or services..." 
              className="h-14 pl-12 pr-4 rounded-full text-lg text-foreground shadow-lg"
            />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 h-14">
            <Link 
              to="/help-center" 
              className={`inline-flex items-center px-1 border-b-2 text-sm font-medium ${isHome ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
            >
              <Book className="mr-2 h-4 w-4" /> Knowledge Base
            </Link>
            <Link 
              to="/help-center/services" 
              className={`inline-flex items-center px-1 border-b-2 text-sm font-medium ${location.pathname.includes('/services') ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
            >
              <HardDrive className="mr-2 h-4 w-4" /> Service Catalog
            </Link>
            <Link 
              to="/help-center/faqs" 
              className={`inline-flex items-center px-1 border-b-2 text-sm font-medium ${location.pathname.includes('/faqs') ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
            >
              <HelpCircle className="mr-2 h-4 w-4" /> FAQs
            </Link>
            <Link 
              to="/help-center/sops" 
              className={`inline-flex items-center px-1 border-b-2 text-sm font-medium ${location.pathname.includes('/sops') ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
            >
              <FileText className="mr-2 h-4 w-4" /> Policies & SOPs
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
