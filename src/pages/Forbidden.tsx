import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Forbidden() {
  const navigate = useNavigate();
  
  return (
    <div className="mx-auto max-w-md py-20 px-4 text-center">
      <Shield className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
      <h1 className="mb-2 text-2xl font-semibold">403 — Admins Only</h1>
      <p className="text-muted-foreground mb-6">
        You need administrator privileges to access this page.
      </p>
      <Button onClick={() => navigate("/")}>
        Return Home
      </Button>
    </div>
  );
}
