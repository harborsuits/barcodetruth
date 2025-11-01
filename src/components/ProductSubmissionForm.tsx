import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Camera, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProductSubmissionFormProps {
  barcode: string;
  manufacturerPrefix?: string;
  onSuccess?: () => void;
}

const CATEGORIES = [
  'Food',
  'Beverage',
  'Household',
  'Personal Care',
  'Health & Beauty',
  'Baby & Child',
  'Pet Supplies',
  'Other',
];

export function ProductSubmissionForm({ barcode, manufacturerPrefix, onSuccess }: ProductSubmissionFormProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    category: '',
    image_url: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to submit products",
          variant: "destructive",
        });
        return;
      }

      // First, find or create brand
      let brandId = null;
      
      const { data: existingBrand } = await supabase
        .from('brands')
        .select('id')
        .ilike('name', formData.brand)
        .single();
      
      if (existingBrand) {
        brandId = existingBrand.id;
      } else {
        const { data: newBrand, error: brandError } = await supabase
          .from('brands')
          .insert({
            name: formData.brand,
            description: 'Community submitted brand',
          })
          .select('id')
          .single();
        
        if (brandError) throw brandError;
        brandId = newBrand.id;
      }

      // Save product submission
      const { error: productError } = await supabase
        .from('products')
        .insert({
          barcode,
          name: formData.name,
          brand_id: brandId,
          category: formData.category,
          image_url: formData.image_url || null,
          data_source: 'user_submitted',
          confidence_score: 50, // Low confidence until verified
          cache_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: {
            submitted_by: user.id,
            submitted_at: new Date().toISOString(),
            manufacturer_prefix: manufacturerPrefix,
          }
        });

      if (productError) throw productError;

      toast({
        title: "Product submitted! 🎉",
        description: "Thank you for helping the community. You've earned a contributor badge!",
      });

      onSuccess?.();
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: "Submission failed",
        description: "Please try again or contact support",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Help Us Identify This Product</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          We couldn't find this product in our database. Help the community by adding it!
        </p>
      </div>

      <div className="space-y-2 p-4 bg-muted rounded-lg">
        <div className="text-sm">
          <span className="font-medium">Barcode:</span> {barcode}
        </div>
        {manufacturerPrefix && (
          <div className="text-sm text-muted-foreground">
            Manufacturer code: {manufacturerPrefix}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Product Name *</Label>
          <Input
            id="name"
            placeholder="e.g., Skippy Creamy Peanut Butter"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="brand">Brand *</Label>
          <Input
            id="brand"
            placeholder="e.g., Skippy"
            value={formData.brand}
            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat.toLowerCase()}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="image">Product Image URL (optional)</Label>
          <Input
            id="image"
            type="url"
            placeholder="https://..."
            value={formData.image_url}
            onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Or use the camera button to take a photo (coming soon)
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit Product'}
        </Button>
      </form>

      <div className="p-4 bg-primary/10 rounded-lg text-sm">
        <div className="flex items-start gap-2">
          <Trophy className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Earn Contributor Badge</p>
            <p className="text-muted-foreground">
              Submit 10 verified products to unlock auto-approval privileges!
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
