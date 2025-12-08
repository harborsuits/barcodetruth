import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnershipBarChart } from "./OwnershipBarChart";
import { KeyFiguresList } from "./KeyFiguresList";
import { Building2 } from "lucide-react";

interface OwnershipSectionProps {
  brandId: string;
  brandName: string;
}

type ShareholderItem = {
  holder_name: string;
  ownership_percentage: number;
  holder_wikidata_qid?: string | null;
  approx_brand_slug?: string | null;
  approx_brand_logo_url?: string | null;
};

type ShareholderBreakdown = {
  company_id: string | null;
  company_name: string | null;
  items: ShareholderItem[];
  others: number | null;
};

type KeyPerson = {
  name: string;
  position: string | null;
  wikidata_qid?: string | null;
  image_url?: string | null;
};

type KeyPeopleData = {
  company_id: string | null;
  company_name: string | null;
  people: KeyPerson[];
};

export function OwnershipSection({ brandId, brandName }: OwnershipSectionProps) {
  const { data: shareholdersData, isLoading: shareholdersLoading } = useQuery({
    queryKey: ["shareholders-breakdown", brandId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_shareholder_breakdown", {
        p_brand_id: brandId,
      });
      if (error) {
        console.error("[OwnershipSection] Shareholders error:", error);
        return null;
      }
      return data as ShareholderBreakdown;
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 30,
  });

  const { data: keyPeopleData, isLoading: keyPeopleLoading } = useQuery({
    queryKey: ["key-people-brand", brandId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_key_people_for_brand", {
        p_brand_id: brandId,
      });
      if (error) {
        console.error("[OwnershipSection] Key people error:", error);
        return null;
      }
      return data as KeyPeopleData;
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 30,
  });

  const isLoading = shareholdersLoading || keyPeopleLoading;
  const hasShareholderData = shareholdersData?.items?.length > 0;
  const hasKeyPeople = keyPeopleData?.people?.length > 0;
  const companyName = shareholdersData?.company_name || keyPeopleData?.company_name;

  // If no parent company found at all, show simple message
  if (!isLoading && !shareholdersData?.company_id && !keyPeopleData?.company_id) {
    return (
      <section className="space-y-4">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Who profits from {brandName}?
          </h2>
        </header>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              This brand appears to be independently operated or we're still researching its corporate structure.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Who profits from {brandName}?
        </h2>
        {companyName && (
          <p className="text-sm text-muted-foreground">
            Top institutional shareholders of {companyName}
          </p>
        )}
      </header>

      {/* Shareholders Bar Chart */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-8 w-1/2" />
            </div>
          ) : (
            <OwnershipBarChart
              items={shareholdersData?.items ?? []}
              others={shareholdersData?.others ?? null}
            />
          )}
        </CardContent>
      </Card>

      {/* Key Figures */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <Skeleton className="h-4 w-40" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : hasKeyPeople ? (
        <Card>
          <CardContent className="pt-6">
            <KeyFiguresList
              people={keyPeopleData?.people ?? []}
              companyName={companyName}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Partial data disclaimer */}
      {(hasShareholderData || hasKeyPeople) && (
        <p className="text-xs text-muted-foreground">
          Data sourced from SEC 13F filings and Wikidata. This is a partial view; not all shareholders may be listed.
        </p>
      )}
    </section>
  );
}
