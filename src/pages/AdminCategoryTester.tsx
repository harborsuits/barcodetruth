import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, TestTube, CheckCircle, AlertCircle, Code } from "lucide-react";

interface TestResult {
  category_code: string;
  matched_rule_id: string;
  match_type: string;
  pattern: string;
  priority: number;
  rule_notes: string;
}

export default function AdminCategoryTester() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [testArticle, setTestArticle] = useState({
    domain: '',
    path: '',
    title: '',
    body: ''
  });
  const [result, setResult] = useState<TestResult | null>(null);
  const [showNoMatch, setShowNoMatch] = useState(false);

  const testCategory = async () => {
    if (!testArticle.title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter at least a title to test",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setResult(null);
    setShowNoMatch(false);

    try {
      const { data, error } = await supabase.rpc('test_article_categorization', {
        p_domain: testArticle.domain.trim() || null,
        p_path: testArticle.path.trim() || null,
        p_title: testArticle.title.trim(),
        p_body: testArticle.body.trim() || null
      });

      if (error) throw error;

      if (data && data.length > 0) {
        setResult(data[0]);
      } else {
        setShowNoMatch(true);
      }
    } catch (error: any) {
      console.error('Category test error:', error);
      toast({
        title: "Test failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadExample = (example: 'recall' | 'lawsuit' | 'labor' | 'environment') => {
    const examples = {
      recall: {
        domain: 'fda.gov',
        path: '/food/recalls/2024',
        title: 'Nestlé Recalls Baby Formula Due to Contamination Risk',
        body: 'The FDA announced that Nestlé is voluntarily recalling certain lots of baby formula products...'
      },
      lawsuit: {
        domain: 'reuters.com',
        path: '/legal/companies',
        title: 'Johnson & Johnson Faces $966M Jury Verdict in Talc Lawsuit',
        body: 'A jury ordered Johnson & Johnson to pay $966 million to plaintiffs who alleged asbestos-contaminated talc products...'
      },
      labor: {
        domain: 'osha.gov',
        path: '/news/2024',
        title: 'Amazon Warehouse Worker Dies in Workplace Accident',
        body: 'OSHA is investigating the death of an Amazon warehouse employee following a forklift accident...'
      },
      environment: {
        domain: 'epa.gov',
        path: '/enforcement/2024',
        title: 'PepsiCo Fined $2M for Water Pollution Violations',
        body: 'The EPA announced enforcement action against PepsiCo for discharging contaminated water...'
      }
    };
    
    setTestArticle(examples[example]);
    setResult(null);
    setShowNoMatch(false);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'product_safety': 'bg-red-500/20 text-red-700 border-red-500/50',
      'legal': 'bg-orange-500/20 text-orange-700 border-orange-500/50',
      'labor': 'bg-blue-500/20 text-blue-700 border-blue-500/50',
      'environment': 'bg-green-500/20 text-green-700 border-green-500/50',
      'politics': 'bg-purple-500/20 text-purple-700 border-purple-500/50',
      'social': 'bg-cyan-500/20 text-cyan-700 border-cyan-500/50'
    };
    return colors[category] || 'bg-gray-500/20 text-gray-700 border-gray-500/50';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <TestTube className="h-6 w-6" />
                Category Tester
              </h1>
              <p className="text-sm text-muted-foreground">
                Test how articles will be categorized based on current rules
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Quick Examples */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Examples</CardTitle>
            <CardDescription>Load example articles to test categorization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => loadExample('recall')}>
                FDA Recall
              </Button>
              <Button variant="outline" size="sm" onClick={() => loadExample('lawsuit')}>
                Legal Lawsuit
              </Button>
              <Button variant="outline" size="sm" onClick={() => loadExample('labor')}>
                OSHA Labor
              </Button>
              <Button variant="outline" size="sm" onClick={() => loadExample('environment')}>
                EPA Environment
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Test Form */}
        <Card>
          <CardHeader>
            <CardTitle>Test Article</CardTitle>
            <CardDescription>
              Enter article details to see what category it would be assigned
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="domain">Domain (optional)</Label>
                <Input
                  id="domain"
                  placeholder="e.g., fda.gov, reuters.com"
                  value={testArticle.domain}
                  onChange={(e) => setTestArticle({...testArticle, domain: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="path">Path (optional)</Label>
                <Input
                  id="path"
                  placeholder="e.g., /food/recalls/2024"
                  value={testArticle.path}
                  onChange={(e) => setTestArticle({...testArticle, path: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Article headline"
                value={testArticle.title}
                onChange={(e) => setTestArticle({...testArticle, title: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Body/Summary (optional)</Label>
              <Textarea
                id="body"
                placeholder="Article content or summary"
                value={testArticle.body}
                onChange={(e) => setTestArticle({...testArticle, body: e.target.value})}
                className="h-32 resize-none"
              />
            </div>

            <Button
              onClick={testCategory}
              disabled={loading || !testArticle.title.trim()}
              className="w-full"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-2" />
                  Test Categorization
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <CardTitle>Match Found</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Category:</span>
                <Badge className={`text-base px-4 py-1 ${getCategoryColor(result.category_code)}`}>
                  {result.category_code.toUpperCase()}
                </Badge>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Matched Rule</div>
                    <div className="text-xs text-muted-foreground">
                      {result.rule_notes || 'No description'}
                    </div>
                  </div>
                  <Badge variant="outline">Priority: {result.priority}</Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Code className="h-3 w-3" />
                    <span className="font-medium">Match Type:</span>
                    <Badge variant="secondary">{result.match_type}</Badge>
                  </div>
                  <div className="font-mono text-xs bg-background p-2 rounded border">
                    {result.pattern}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Rule ID: <span className="font-mono">{result.matched_rule_id}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {showNoMatch && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>No matching rules found.</strong>
              <br />
              This article would be categorized as <Badge variant="outline" className="ml-1">GENERAL/NOISE</Badge>
              <br />
              <span className="text-sm">Consider adding a new rule to match this type of content.</span>
            </AlertDescription>
          </Alert>
        )}

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>• Rules are matched by priority (highest first)</p>
            <p>• Domain and path rules use exact regex matching</p>
            <p>• Title and body rules are case-insensitive</p>
            <p>• First matching rule determines the category</p>
            <p>• If no rules match, the event goes to "general"</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
