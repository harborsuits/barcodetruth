import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Building2, ChevronDown, Network } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

interface TreeNode {
  id: string;
  name: string;
  logo_url?: string;
  is_public?: boolean;
  ticker?: string;
  type?: string;
}

export function CorporateFamilyTree({ brandId, brandName, scannedBrandId }: { brandId: string; brandName: string; scannedBrandId?: string }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const { data: ownership, isLoading } = useQuery({
    queryKey: ["corporate-family-tree", brandId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_brand_ownership" as any, {
        p_brand_id: brandId,
      });
      if (error) return null;
      return data as any;
    },
    enabled: !!brandId,
    staleTime: 1000 * 60 * 30,
  });

  const chain: TreeNode[] = ownership?.structure?.chain || [];
  const siblings: TreeNode[] = ownership?.structure?.siblings || [];

  const parentCompany = chain.length > 1 ? chain[chain.length - 1] : null;
  // Filter self-referential parent
  const showParent = parentCompany && 
    parentCompany.name.trim().toLowerCase() !== brandName.trim().toLowerCase();
  
  const allSiblings = siblings.filter((s) => s.id !== brandId);
  const hasFamilyData = showParent || allSiblings.length > 0;

  if (isLoading) {
    return <Skeleton className="h-20 w-full rounded-lg" />;
  }

  if (!hasFamilyData) return null;

  const totalFamily = allSiblings.length + 1;

  const goToBrand = (id: string) => {
    navigate(`/brand/${id}`, { state: { fromBrand: true, scannedBrandId: scannedBrandId || brandId, scannedBrandName: brandName } });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden border-primary/20">
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <CardContent className="pt-5 pb-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Network className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                    Corporate Family
                  </p>
                  <p className="text-sm font-semibold">
                    {showParent ? parentCompany!.name : brandName}
                    {totalFamily > 1 && (
                      <span className="text-muted-foreground font-normal ml-1.5 text-xs">
                        · {totalFamily} brands
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </CardContent>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="px-5 pb-5"
              >
                <div className="relative space-y-1">
                  {/* ── Parent (root) ── */}
                  {showParent && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 }}
                    >
                      <FamilyNodeCard
                        node={parentCompany!}
                        variant="parent"
                        onClick={() => goToBrand(parentCompany!.id)}
                      />
                      {/* Vertical connector */}
                      <div className="flex justify-center">
                        <motion.div
                          className="w-px h-5 bg-border"
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          transition={{ delay: 0.12, duration: 0.15 }}
                          style={{ transformOrigin: "top" }}
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* ── Current brand (highlighted) ── */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.18 }}
                  >
                    <FamilyNodeCard
                      node={{ id: brandId, name: brandName, logo_url: chain[0]?.logo_url }}
                      variant="current"
                    />
                  </motion.div>

                  {/* ── Sister brands ── */}
                  {allSiblings.length > 0 && (
                    <>
                      {showParent && (
                        <div className="flex justify-center">
                          <motion.div
                            className="w-px h-3 bg-border"
                            initial={{ scaleY: 0 }}
                            animate={{ scaleY: 1 }}
                            transition={{ delay: 0.22, duration: 0.1 }}
                            style={{ transformOrigin: "top" }}
                          />
                        </div>
                      )}

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.25 }}
                        className="pt-1"
                      >
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2 text-center">
                          Also owned by {showParent ? parentCompany!.name : "same parent"}
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {allSiblings.slice(0, 8).map((sib, i) => (
                            <motion.div
                              key={sib.id}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.3 + i * 0.04 }}
                            >
                              <FamilyNodeCard
                                node={sib}
                                variant="sibling"
                                onClick={() => goToBrand(sib.id)}
                              />
                            </motion.div>
                          ))}
                        </div>
                        {allSiblings.length > 8 && (
                          <p className="text-xs text-muted-foreground text-center mt-2">
                            + {allSiblings.length - 8} more brands
                          </p>
                        )}
                      </motion.div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/* ── Individual node card ── */
function FamilyNodeCard({
  node,
  variant,
  onClick,
}: {
  node: TreeNode;
  variant: "parent" | "current" | "sibling";
  onClick?: () => void;
}) {
  const isClickable = variant !== "current" && !!onClick;

  const styles = {
    parent: "p-3",
    current: "p-3 ring-2 ring-primary bg-primary/5",
    sibling: "p-2",
  };

  const logoSizes = {
    parent: "w-10 h-10",
    current: "w-10 h-10",
    sibling: "w-7 h-7",
  };

  const iconSizes = {
    parent: "h-5 w-5",
    current: "h-5 w-5",
    sibling: "h-3.5 w-3.5",
  };

  const textStyles = {
    parent: "text-sm font-semibold",
    current: "text-sm font-bold",
    sibling: "text-xs font-medium",
  };

  return (
    <div
      className={`
        flex items-center gap-2.5 rounded-lg border bg-card
        ${styles[variant]}
        ${isClickable ? "cursor-pointer hover:bg-accent active:scale-[0.98] transition-all" : ""}
      `}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => e.key === "Enter" && onClick?.() : undefined}
    >
      {node.logo_url ? (
        <img
          src={node.logo_url}
          alt={`${node.name} logo`}
          className={`${logoSizes[variant]} rounded object-contain bg-muted p-0.5 flex-shrink-0`}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <div
          className={`${logoSizes[variant]} rounded bg-muted flex items-center justify-center flex-shrink-0`}
        >
          <Building2 className={`${iconSizes[variant]} text-muted-foreground`} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={`${textStyles[variant]} truncate`}>{node.name}</p>
        {variant === "parent" && (
          <Badge variant="outline" className="text-[9px] mt-0.5 px-1.5 py-0">
            Parent Company
          </Badge>
        )}
        {variant === "current" && (
          <Badge className="text-[9px] mt-0.5 px-1.5 py-0 bg-primary/15 text-primary border-primary/20">
            This brand
          </Badge>
        )}
      </div>
    </div>
  );
}
