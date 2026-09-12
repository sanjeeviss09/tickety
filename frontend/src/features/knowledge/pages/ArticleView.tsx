import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useKnowledgeStore } from '../../../store/knowledgeStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown, Calendar, User, ArrowLeft, MessageSquare } from 'lucide-react';
import DOMPurify from 'dompurify';
import { format } from 'date-fns';
import api from '../../../lib/api';
import { Textarea } from '@/components/ui/textarea';

export function ArticleView() {
  const { slug } = useParams();
  const { currentArticle, fetchArticleBySlug, rateArticle, loading } = useKnowledgeStore();

  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchArticleBySlug(slug);
    }
  }, [slug, fetchArticleBySlug]);

  useEffect(() => {
    if (currentArticle) {
      fetchComments();
    }
  }, [currentArticle?.id]);

  const fetchComments = async () => {
    try {
      const res = await api.get(`/knowledge/articles/${currentArticle!.id}/comments`);
      setComments(res.data.data);
    } catch (err) {
      console.error('Failed to fetch comments', err);
    }
  };

  if (loading || !currentArticle) {
    return <div className="py-20 text-center">Loading article...</div>;
  }

  const handleRate = async (isHelpful: boolean) => {
    await rateArticle(currentArticle.id, isHelpful);
    if (slug) fetchArticleBySlug(slug);
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      await api.post(`/knowledge/articles/${currentArticle.id}/comments`, { content: newComment });
      setNewComment('');
      fetchComments();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 bg-card p-8 rounded-xl border shadow-sm">
      <Link to="/help-center" className="text-muted-foreground hover:text-primary flex items-center text-sm">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Knowledge Base
      </Link>

      <header className="space-y-4 border-b pb-8">
        <div className="flex gap-2">
          <Badge variant="secondary">{currentArticle.knowledge_categories?.name}</Badge>
          {currentArticle.article_tags?.map(t => (
            <Badge key={t.tag} variant="outline">{t.tag}</Badge>
          ))}
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight">{currentArticle.title}</h1>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-2"><User className="h-4 w-4" /> {currentArticle.author?.raw_user_meta_data?.full_name || 'System'}</span>
          <span className="flex items-center gap-2"><Calendar className="h-4 w-4" /> {format(new Date(currentArticle.updated_at), 'MMMM d, yyyy')}</span>
          <span>{currentArticle.views_count} views</span>
        </div>
      </header>

      <div 
        className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentArticle.content) }}
      />

      <div className="border-t pt-8 mt-12 flex flex-col items-center justify-center space-y-4">
        <h3 className="text-lg font-semibold">Was this article helpful?</h3>
        <div className="flex gap-4">
          <Button variant="outline" size="lg" className="hover:bg-green-50 hover:text-green-600 hover:border-green-200" onClick={() => handleRate(true)}>
            <ThumbsUp className="mr-2 h-5 w-5" /> Yes ({currentArticle.helpful_count})
          </Button>
          <Button variant="outline" size="lg" className="hover:bg-red-50 hover:text-red-600 hover:border-red-200" onClick={() => handleRate(false)}>
            <ThumbsDown className="mr-2 h-5 w-5" /> No ({currentArticle.not_helpful_count})
          </Button>
        </div>
      </div>

      {currentArticle.allow_comments && (
        <div className="border-t pt-8 mt-12 space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Comments ({comments.length})</h3>
          <div className="space-y-4">
            <Textarea 
              placeholder="Add a comment or ask a question..." 
              value={newComment} 
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[100px]"
            />
            <div className="flex justify-end">
              <Button onClick={handlePostComment} disabled={submittingComment || !newComment.trim()}>
                Post Comment
              </Button>
            </div>
          </div>
          <div className="space-y-4 mt-8">
            {comments.map((c: any) => (
              <div key={c.id} className="bg-muted/30 p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground flex items-center gap-2">
                    <User className="h-3 w-3" /> {c.user?.raw_user_meta_data?.full_name || 'User'}
                  </span>
                  <span>{format(new Date(c.created_at), 'MMM d, yyyy h:mm a')}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
