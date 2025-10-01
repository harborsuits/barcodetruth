import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const mockFollowing = [
  { id: "patagonia", name: "Patagonia", score: 91 },
  { id: "allbirds", name: "Allbirds", score: 89 },
];

const mockAvoiding = [
  { id: "amazon", name: "Amazon", score: 45 },
];

const Lists = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("following");

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-success";
    if (score >= 40) return "text-warning";
    return "text-danger";
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">My Lists</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="following">Following</TabsTrigger>
            <TabsTrigger value="avoiding">Avoiding</TabsTrigger>
          </TabsList>

          <TabsContent value="following" className="mt-6 space-y-3">
            {mockFollowing.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No brands in your following list yet
                </CardContent>
              </Card>
            ) : (
              mockFollowing.map((brand) => (
                <Card
                  key={brand.id}
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => navigate(`/brand/${brand.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{brand.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-bold ${getScoreColor(brand.score)}`}>
                          {brand.score}
                        </span>
                        <span className="text-sm text-muted-foreground">/100</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="avoiding" className="mt-6 space-y-3">
            {mockAvoiding.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No brands in your avoiding list yet
                </CardContent>
              </Card>
            ) : (
              mockAvoiding.map((brand) => (
                <Card
                  key={brand.id}
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => navigate(`/brand/${brand.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{brand.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-bold ${getScoreColor(brand.score)}`}>
                          {brand.score}
                        </span>
                        <span className="text-sm text-muted-foreground">/100</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Lists;
