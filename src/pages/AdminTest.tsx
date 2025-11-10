import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Loader2, Play, CheckCircle, XCircle } from 'lucide-react';

interface Brand {
  id: string;
  name: string;
  wikidata_qid: string | null;
}

interface TestResult {
  functionName: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  request?: any;
  response?: any;
  error?: any;
  timestamp?: string;
}

export default function AdminTest() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBrands();
  }, []);

  async function loadBrands() {
    const { data } = await supabase
      .from('brands')
      .select('id, name, wikidata_qid')
      .not('wikidata_qid', 'is', null)
      .order('name')
      .limit(50);
    
    if (data) setBrands(data);
  }

  async function testFunction(
    functionName: string,
    body: any,
    description: string
  ) {
    if (!selectedBrand) {
      alert('Please select a brand first');
      return;
    }

    const testResult: TestResult = {
      functionName: `${functionName} - ${description}`,
      status: 'loading',
      request: body,
      timestamp: new Date().toISOString(),
    };

    setResults(prev => [testResult, ...prev]);
    setLoading(true);

    try {
      console.log(`[AdminTest] Testing ${functionName}:`, body);
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body,
      });

      console.log(`[AdminTest] ${functionName} response:`, { data, error });

      setResults(prev =>
        prev.map(r =>
          r.timestamp === testResult.timestamp
            ? {
                ...r,
                status: error ? 'error' : 'success',
                response: data,
                error,
              }
            : r
        )
      );
    } catch (err: any) {
      console.error(`[AdminTest] ${functionName} exception:`, err);
      
      setResults(prev =>
        prev.map(r =>
          r.timestamp === testResult.timestamp
            ? {
                ...r,
                status: 'error',
                error: err.message,
              }
            : r
        )
      );
    } finally {
      setLoading(false);
    }
  }

  const handleBrandSelect = (brandId: string) => {
    const brand = brands.find(b => b.id === brandId);
    setSelectedBrand(brand || null);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Edge Function Tester</h1>
        <p className="text-muted-foreground">
          Test edge functions with proper parameters
        </p>
      </div>

      {/* Brand Selector */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Select Brand</h2>
        <Select onValueChange={handleBrandSelect}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a brand to test..." />
          </SelectTrigger>
          <SelectContent>
            {brands.map(brand => (
              <SelectItem key={brand.id} value={brand.id}>
                {brand.name} ({brand.wikidata_qid || 'no QID'})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedBrand && (
          <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
            <p className="text-sm">
              <strong>Brand ID:</strong> {selectedBrand.id}
            </p>
            <p className="text-sm">
              <strong>Name:</strong> {selectedBrand.name}
            </p>
            <p className="text-sm">
              <strong>Wikidata QID:</strong> {selectedBrand.wikidata_qid || 'None'}
            </p>
          </div>
        )}
      </Card>

      {/* Test Buttons */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Test Functions</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Button
            onClick={() =>
              testFunction(
                'enrich-brand-wiki',
                {
                  brand_id: selectedBrand?.id,
                  wikidata_qid: selectedBrand?.wikidata_qid,
                  mode: 'full',
                },
                'Full enrichment'
              )
            }
            disabled={loading || !selectedBrand}
            className="justify-start"
          >
            <Play className="h-4 w-4 mr-2" />
            Test enrich-brand-wiki (full)
          </Button>

          <Button
            onClick={() =>
              testFunction(
                'enrich-brand-wiki',
                {
                  brand_id: selectedBrand?.id,
                  mode: 'basic',
                },
                'Basic mode'
              )
            }
            disabled={loading || !selectedBrand}
            className="justify-start"
          >
            <Play className="h-4 w-4 mr-2" />
            Test enrich-brand-wiki (basic)
          </Button>

          <Button
            onClick={() =>
              testFunction(
                'generate-event-summaries',
                {
                  brand_id: selectedBrand?.id,
                  limit: 5,
                },
                'Generate summaries'
              )
            }
            disabled={loading || !selectedBrand}
            className="justify-start"
          >
            <Play className="h-4 w-4 mr-2" />
            Test generate-event-summaries
          </Button>

          <Button
            onClick={() =>
              testFunction(
                'seed-brand-base-data',
                {
                  brand_id: selectedBrand?.id,
                  wikidata_qid: selectedBrand?.wikidata_qid,
                  brand_name: selectedBrand?.name,
                },
                'Seed base data'
              )
            }
            disabled={loading || !selectedBrand}
            className="justify-start"
          >
            <Play className="h-4 w-4 mr-2" />
            Test seed-brand-base-data
          </Button>

          <Button
            onClick={() =>
              testFunction(
                'recompute-brand-scores',
                {
                  brand_id: selectedBrand?.id,
                },
                'Recompute scores'
              )
            }
            disabled={loading || !selectedBrand}
            className="justify-start"
          >
            <Play className="h-4 w-4 mr-2" />
            Test recompute-brand-scores
          </Button>

          <Button
            onClick={() =>
              testFunction(
                'resolve-brand-logo',
                {
                  brand_id: selectedBrand?.id,
                },
                'Resolve logo'
              )
            }
            disabled={loading || !selectedBrand}
            className="justify-start"
          >
            <Play className="h-4 w-4 mr-2" />
            Test resolve-brand-logo
          </Button>
        </div>
      </Card>

      {/* Results */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Test Results</h2>
          {results.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResults([])}
            >
              Clear Results
            </Button>
          )}
        </div>

        {results.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No tests run yet. Select a brand and click a test button.
          </p>
        ) : (
          <div className="space-y-4">
            {results.map((result, idx) => (
              <div
                key={idx}
                className="border rounded-lg p-4 space-y-3 bg-card"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {result.status === 'loading' && (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    )}
                    {result.status === 'success' && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    {result.status === 'error' && (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <h3 className="font-semibold">{result.functionName}</h3>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(result.timestamp!).toLocaleTimeString()}
                  </span>
                </div>

                <div className="space-y-2">
                  <details className="text-sm">
                    <summary className="cursor-pointer font-medium mb-1">
                      Request Body
                    </summary>
                    <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                      {JSON.stringify(result.request, null, 2)}
                    </pre>
                  </details>

                  {result.status !== 'loading' && (
                    <details
                      className="text-sm"
                      open={result.status === 'error'}
                    >
                      <summary className="cursor-pointer font-medium mb-1">
                        {result.status === 'error' ? 'Error' : 'Response'}
                      </summary>
                      <pre
                        className={`p-3 rounded text-xs overflow-x-auto ${
                          result.status === 'error'
                            ? 'bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100'
                            : 'bg-muted'
                        }`}
                      >
                        {JSON.stringify(
                          result.error || result.response,
                          null,
                          2
                        )}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
