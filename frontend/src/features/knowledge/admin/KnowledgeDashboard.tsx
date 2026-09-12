import { useEffect } from 'react';
import { useKnowledgeStore } from '../../../store/knowledgeStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Eye, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FaqManager } from './FaqManager';
import { SopManager } from './SopManager';

export function KnowledgeDashboard() {
  const { articles, fetchArticles, loading } = useKnowledgeStore();

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Base Admin</h1>
          <p className="text-muted-foreground mt-1">Manage articles, categories, and settings.</p>
        </div>
        <Link to="/kb-admin/articles/new">
          <Button><Plus className="mr-2 h-4 w-4" /> New Article</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{articles.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{articles.filter(a => a.status === 'Published').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Drafts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{articles.filter(a => a.status === 'Draft').length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="articles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="articles">Articles</TabsTrigger>
          <TabsTrigger value="faqs">FAQs</TabsTrigger>
          <TabsTrigger value="sops">SOPs</TabsTrigger>
        </TabsList>
        <TabsContent value="articles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Articles</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p>Loading...</p>
              ) : (
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Title</th>
                        <th className="px-4 py-3 text-left font-medium">Category</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-right font-medium">Views</th>
                        <th className="px-4 py-3 text-right font-medium">Rating</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {articles.map((article) => (
                        <tr key={article.id} className="border-t hover:bg-muted/50">
                          <td className="px-4 py-3 font-medium">{article.title}</td>
                          <td className="px-4 py-3">{article.knowledge_categories?.name}</td>
                          <td className="px-4 py-3">
                            <Badge variant={article.status === 'Published' ? 'default' : 'secondary'}>
                              {article.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground flex items-center justify-end gap-1">
                            <Eye className="h-4 w-4" /> {article.views_count}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            <div className="flex items-center justify-end gap-2">
                              <span className="flex items-center gap-1 text-green-600"><ThumbsUp className="h-3 w-3" /> {article.helpful_count}</span>
                              <span className="flex items-center gap-1 text-red-600"><ThumbsDown className="h-3 w-3" /> {article.not_helpful_count}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link to={`/kb-admin/articles/${article.id}/edit`}>
                              <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                      {articles.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No articles found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="faqs">
          <FaqManager />
        </TabsContent>
        <TabsContent value="sops">
          <SopManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
