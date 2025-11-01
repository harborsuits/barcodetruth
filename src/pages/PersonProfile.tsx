import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User, ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function PersonProfile() {
  const { id } = useParams<{ id: string }>();

  // Fetch person data and their positions
  const { data: personData, isLoading } = useQuery({
    queryKey: ['person', id],
    queryFn: async () => {
      if (!id) return null;

      // Get person positions
      const { data: positions, error } = await supabase
        .from('company_people')
        .select('person_name, role, person_qid, image_url, company_id')
        .eq('person_name', decodeURIComponent(id));

      if (error) throw error;
      if (!positions || positions.length === 0) return null;

      // Get company details for each position
      const companyIds = positions.map(p => p.company_id);
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name, logo_url, is_public, ticker')
        .in('id', companyIds);

      // Merge the data
      return positions.map(position => ({
        ...position,
        company: companies?.find(c => c.id === position.company_id)
      }));
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!personData || personData.length === 0) {
    return (
      <div className="container max-w-4xl mx-auto p-6">
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold">Person not found</h1>
        </div>
      </div>
    );
  }

  const personName = personData[0].person_name;
  const imageUrl = personData[0].image_url;
  const wikidataQid = personData[0].person_qid;

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <Link to="/">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={personName}
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-10 w-10 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold">{personName}</h1>
            {wikidataQid && (
              <a
                href={`https://www.wikidata.org/wiki/${wikidataQid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                View on Wikidata
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Board Positions & Roles */}
      <div className="rounded-2xl border p-6">
        <h2 className="text-xl font-semibold mb-4">Board Positions & Leadership Roles</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Organizations where {personName} holds leadership positions
        </p>

        <div className="space-y-4">
          {personData.map((position, idx) => {
            const company = position.company;

            return (
              <div key={`${position.company_id}-${idx}`} className="border rounded-lg p-4">
                <div className="flex items-center gap-3">
                  {company?.logo_url && (
                    <img
                      src={company.logo_url}
                      alt={company.name}
                      className="h-10 w-10 object-contain"
                    />
                  )}
                  <div>
                    <h3 className="font-semibold">{company?.name || 'Unknown Company'}</h3>
                    <p className="text-sm text-muted-foreground">{position.role}</p>
                    {company?.ticker && (
                      <p className="text-xs text-muted-foreground">
                        {company.ticker} • {company.is_public ? 'Public' : 'Private'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
