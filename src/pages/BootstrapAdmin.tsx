import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";

export default function BootstrapAdmin() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleBootstrap = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Not authenticated",
          description: "Please sign in first",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('bootstrap-admin');
      
      if (error) throw error;

      toast({
        title: "Success!",
        description: data.message || "You are now an admin",
      });

      // Refresh the page to update admin status
      setTimeout(() => {
        navigate('/admin/health');
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="p-6 max-w-md w-full">
        <div className="flex flex-col items-center text-center space-y-4">
          <Shield className="h-12 w-12 text-primary" />
          <h1 className="text-2xl font-bold">Bootstrap Admin</h1>
          <p className="text-muted-foreground">
            Click the button below to grant yourself admin privileges. This only works if no admin exists yet.
          </p>
          <Button 
            onClick={handleBootstrap} 
            disabled={loading}
            className="w-full"
          >
            {loading ? "Processing..." : "Make Me Admin"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
