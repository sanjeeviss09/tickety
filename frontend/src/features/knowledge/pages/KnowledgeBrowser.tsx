import { useEffect, useState } from 'react';
import { useKnowledgeStore } from '../../../store/knowledgeStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Eye, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function KnowledgeBrowser() {
  const { articles, categories, fetchArticles, fetchCategories, loading } = useKnowledgeStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  useEffect(() => {
    fetchCategories();
    fetchArticles({ status: 'Published' });
  }, [fetchCategories, fetchArticles]);

  useEffect(() => {
    fetchArticles({ status: 'Published', category_id: selectedCategory || undefined });
  }, [selectedCategory, fetchArticles]);

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Sidebar Filters */}
      <div className="w-full md:w-64 space-y-6">
        <div>
          <h3 className="font-semibold mb-4 text-lg border-b pb-2">Categories</h3>
          <ul className="space-y-2">
            <li>
              <Button 
                variant={selectedCategory === '' ? 'secondary' : 'ghost'} 
                className="w-full justify-start"
                onClick={() => setSelectedCategory('')}
              >
                All Categories
              </Button>
            </li>
            {categories.map(c => (
              <li key={c.id}>
                <Button 
                  variant={selectedCategory === c.id ? 'secondary' : 'ghost'} 
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory(c.id)}
                >
                  {c.name}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Article List */}
      <div className="flex-1 space-y-4">
        {loading ? (
          <div className="py-20 text-center">Loading articles...</div>
        ) : articles.length > 0 ? (
          articles.map(article => (
            <Link key={article.id} to={`/help-center/article/${article.slug}`} className="block">
              <Card className="hover:shadow-md transition-all hover:border-primary/50">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start gap-4">
                    <CardTitle className="text-xl text-primary">{article.title}</CardTitle>
                    <Badge variant="outline">{article.knowledge_categories?.name}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm line-clamp-2">
                    {article.excerpt || article.content.replace(/<[^>]+>/g, '').substring(0, 150) + '...'}
                  </p>
                  <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {article.views_count}</span>
                    <span className="flex items-center gap-1 text-green-600"><ThumbsUp className="h-3 w-3" /> {article.helpful_count} helpful</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        ) : (
          <div className="text-center py-20 bg-card rounded-lg border">
            <h3 className="text-lg font-medium text-muted-foreground">No articles found</h3>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or category filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
