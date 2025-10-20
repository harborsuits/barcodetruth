import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function AdminTestScorer() {
  const navigate = useNavigate();
  const [test1Result, setTest1Result] = useState<any>(null);
  const [test2Result, setTest2Result] = useState<any>(null);
  const [test3Result, setTest3Result] = useState<any>(null);
  const [batchResult, setBatchResult] = useState<any>(null);
  const [eventStats, setEventStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const runTests = async () => {
    setLoading(true);
    try {
      // Test 1: P&G Earnings (should pass)
      const { data: t1, error: e1 } = await supabase.functions.invoke('test-relevance-scorer', {
        body: {
          brand_id: '9b17d116-f144-4bde-8f16-9c93f6feeaf4',
          title: 'Procter & Gamble Reports Q3 Earnings Beat',
          body: 'Company announces strong quarterly results'
        }
      });
      setTest1Result({ data: t1, error: e1 });

      // Test 2: Nestlé with accent
      const { data: t2, error: e2 } = await supabase.functions.invoke('test-relevance-scorer', {
        body: {
          brand_id: 'ced5176a-2adf-4a89-8070-33acd1f4188c',
          title: 'Nestlé dumps Dairy Methane Action Alliance',
          body: 'The company announced strategic changes'
        }
      });
      setTest2Result({ data: t2, error: e2 });

      // Test 3: Irrelevant (should fail)
      const { data: t3, error: e3 } = await supabase.functions.invoke('test-relevance-scorer', {
        body: {
          brand_id: '9b17d116-f144-4bde-8f16-9c93f6feeaf4',
          title: 'Australian weather forecast for summer',
          body: 'Hot temperatures expected'
        }
      });
      setTest3Result({ data: t3, error: e3 });

      toast({
        title: "Tests Complete",
        description: "All 3 test cases have been executed"
      });
    } catch (error) {
      console.error('Test error:', error);
      toast({
        variant: "destructive",
        title: "Test Failed",
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerBatchProcessing = async () => {
    setLoading(true);
    try {
      // Use mode=all to process all active brands (bypasses empty queue)
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const response = await fetch(
        'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/batch-process-brands?mode=all&limit=5',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const data = await response.json();
      setBatchResult({ data, error: null });
      
      toast({
        title: "Batch Processing Started",
        description: `Processing ${data.processed || 0} brands`
      });
    } catch (error: any) {
      console.error('Batch error:', error);
      toast({
        variant: "destructive",
        title: "Batch Processing Failed",
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const checkEventStats = async () => {
    setLoading(true);
    try {
      // Query events from last 10 minutes with brand names
      const { data: events, error: evError } = await supabase
        .from('brand_events')
        .select(`
          brand_id,
          relevance_score_raw,
          event_date,
          created_at,
          brands!inner(name)
        `)
        .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

      if (evError) throw evError;

      // Group manually by brand name
      const grouped = (events || []).reduce((acc: any, ev: any) => {
        const name = ev.brands.name;
        if (!acc[name]) {
          acc[name] = {
            name,
            event_count: 0,
            scores: [],
            dates: []
          };
        }
        acc[name].event_count++;
        acc[name].scores.push(ev.relevance_score_raw);
        acc[name].dates.push(ev.event_date);
        return acc;
      }, {});

      const stats = Object.values(grouped).map((g: any) => ({
        name: g.name,
        event_count: g.event_count,
        avg_score: (g.scores.reduce((a: number, b: number) => a + b, 0) / g.scores.length).toFixed(1),
        min_score: Math.min(...g.scores),
        max_score: Math.max(...g.scores),
        latest_event: g.dates.sort().reverse()[0]
      }));

      setEventStats(stats);

      toast({
        title: "Event Stats Loaded",
        description: `Found ${stats.length} brands with recent events`
      });
    } catch (error) {
      console.error('Stats error:', error);
      toast({
        variant: "destructive",
        title: "Failed to Load Stats",
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setLoading(false);
    }
  };

  const renderTestResult = (title: string, result: any) => {
    if (!result) return null;
    
    const { data, error } = result;
    if (error) {
      return (
        <Card className="p-4 border-destructive">
          <h3 className="font-semibold text-destructive mb-2">{title} - ERROR</h3>
          <pre className="text-sm overflow-auto">{JSON.stringify(error, null, 2)}</pre>
        </Card>
      );
    }

    const breakdown = data?.breakdown || {};
    const passed = breakdown.score >= 11;

    return (
      <Card className={`p-4 ${passed ? 'border-green-500' : 'border-yellow-500'}`}>
        <h3 className="font-semibold mb-2">{title} - {passed ? '✅ PASS' : '⚠️ FAIL'}</h3>
        <div className="space-y-2 text-sm">
          <div><strong>Brand:</strong> {data?.brand}</div>
          <div><strong>Title:</strong> {data?.title}</div>
          <div><strong>Score:</strong> {breakdown.score}/20 {passed ? '(≥11 threshold)' : '(<11 threshold)'}</div>
          <div><strong>Reason:</strong> {breakdown.reason}</div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>hardExclude: {breakdown.hardExclude ? '❌' : '✅'}</div>
            <div>titleHit: {breakdown.titleHit ? '✅' : '❌'}</div>
            <div>leadHit: {breakdown.leadHit ? '✅' : '❌'}</div>
            <div>context: {breakdown.context ? '✅' : '❌'}</div>
            <div>proxHit: {breakdown.proxHit ? '✅' : '❌'}</div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-8 space-y-6">
      <div>
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold mb-2">Relevance Scorer Test Suite</h1>
        <p className="text-muted-foreground">
          Test the fixed relevance scoring and trigger batch ingestion
        </p>
      </div>

      <div className="flex gap-4">
        <Button onClick={runTests} disabled={loading}>
          Run All Tests
        </Button>
        <Button onClick={triggerBatchProcessing} disabled={loading} variant="secondary">
          Trigger Batch Processing (Top 5)
        </Button>
        <Button onClick={checkEventStats} disabled={loading} variant="outline">
          Check Event Stats
        </Button>
      </div>

      {(test1Result || test2Result || test3Result) && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Test Results</h2>
          {renderTestResult("Test 1: P&G Earnings (Expected: PASS, score ≥13)", test1Result)}
          {renderTestResult("Test 2: Nestlé with Accent (Expected: PASS, score ≥10)", test2Result)}
          {renderTestResult("Test 3: Irrelevant Article (Expected: FAIL, score <11)", test3Result)}
        </div>
      )}

      {batchResult && (
        <Card className="p-4">
          <h2 className="text-2xl font-semibold mb-4">Batch Processing Result</h2>
          <pre className="text-sm overflow-auto max-h-96">
            {JSON.stringify(batchResult, null, 2)}
          </pre>
        </Card>
      )}

      {eventStats.length > 0 && (
        <Card className="p-4">
          <h2 className="text-2xl font-semibold mb-4">Recent Events (Last 10 Minutes)</h2>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Brand</th>
                  <th className="text-left p-2">Events</th>
                  <th className="text-left p-2">Avg Score</th>
                  <th className="text-left p-2">Min Score</th>
                  <th className="text-left p-2">Max Score</th>
                  <th className="text-left p-2">Latest Event</th>
                </tr>
              </thead>
              <tbody>
                {eventStats.map((stat, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{stat.name}</td>
                    <td className="p-2">{stat.event_count}</td>
                    <td className="p-2">{stat.avg_score}</td>
                    <td className="p-2">{stat.min_score}</td>
                    <td className="p-2">{stat.max_score}</td>
                    <td className="p-2">{new Date(stat.latest_event).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
