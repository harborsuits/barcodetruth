import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Share2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useBrandLogo } from "@/hooks/useBrandLogo";

/* ── Verdict helpers ── */
const getVerdict = (s: number | null) => {
  if (s === null) return { label: "Unrated", color: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted) / 0.4)" };
  if (s >= 65) return { label: "Trust", color: "hsl(var(--success))", bg: "hsl(var(--success-light))" };
  if (s >= 40) return { label: "Caution", color: "hsl(var(--warning))", bg: "hsl(var(--warning-light))" };
  return { label: "Avoid", color: "hsl(var(--danger))", bg: "hsl(var(--danger-light))" };
};

const getVerdictEmoji = (s: number | null) => {
  if (s === null) return "—";
  if (s >= 65) return "🟢";
  if (s >= 40) return "🟡";
  return "🔴";
};

/* ── Score ring with animated counter ── */
function ScoreRing({ score, verdict }: { score: number | null; verdict: string }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const v = getVerdict(score);
  const size = 72;
  const stroke = 4;
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = score != null ? score / 100 : 0;

  useEffect(() => {
    if (score === null) return;
    let start: number | null = null;
    const dur = 1000;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setAnimatedScore(Math.round(eased * score));
      if (p < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [score]);

  if (score === null) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <span>Unrated</span>
      </div>
    );
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={v.color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - pct) }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-extrabold tracking-tighter" style={{ color: v.color }}>
          {animatedScore}
        </span>
      </div>
    </div>
  );
}

/* ── Brand node in the tree ── */
function TreeNode({
  name,
  logoUrl,
  website,
  isCurrent,
  delay,
  onClick,
  score,
}: {
  name: string;
  logoUrl?: string | null;
  website?: string | null;
  isCurrent?: boolean;
  delay: number;
  onClick?: () => void;
  score?: number | null;
}) {
  const displayLogo = useBrandLogo(logoUrl || null, website || null);
  const monogram = name?.[0]?.toUpperCase() ?? "?";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        delay,
        duration: 0.5,
        type: "spring",
        stiffness: 200,
        damping: 20,
      }}
      onClick={onClick}
      className={`
        flex flex-col items-center gap-2 p-3 rounded-lg border backdrop-blur-sm
        ${isCurrent
          ? "ring-2 ring-primary bg-primary/10 border-primary/30"
          : "bg-card/60 border-border/60 hover:bg-card hover:border-border cursor-pointer active:scale-95"
        }
        transition-all duration-200 min-w-[80px]
      `}
    >
      {/* Logo */}
      <div className={`${isCurrent ? "w-14 h-14" : "w-11 h-11"} rounded-lg overflow-hidden bg-muted flex items-center justify-center flex-shrink-0`}>
        {displayLogo ? (
          <img src={displayLogo} alt={name} className="w-full h-full object-contain p-1" loading="lazy" />
        ) : (
          <span className="text-lg font-bold text-muted-foreground/40">{monogram}</span>
        )}
      </div>

      {/* Name */}
      <span className={`text-center leading-tight ${isCurrent ? "text-sm font-bold text-foreground" : "text-xs font-medium text-foreground/80"}`}>
        {name}
      </span>

      {/* Badge */}
      {isCurrent && (
        <Badge className="text-[9px] bg-primary/15 text-primary border-primary/20 px-1.5 py-0">
          You scanned this
        </Badge>
      )}
    </motion.div>
  );
}

/* ── Animated connector line ── */
function Connector({ delay, height = 28 }: { delay: number; height?: number }) {
  return (
    <div className="flex justify-center">
      <motion.div
        className="bg-border"
        style={{ width: 1 }}
        initial={{ height: 0, opacity: 0 }}
        animate={{ height, opacity: 1 }}
        transition={{ delay, duration: 0.3, ease: "easeOut" }}
      />
    </div>
  );
}

/* ── Share card for screenshots ── */
function ShareCard({
  brandName,
  score,
  verdict,
  parentName,
  siblings,
}: {
  brandName: string;
  score: number | null;
  verdict: ReturnType<typeof getVerdict>;
  parentName: string;
  siblings: { name: string; logo_url?: string }[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className="rounded-lg border border-border bg-card p-5 space-y-4 max-w-sm mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold">{brandName}</p>
          <div className="flex items-center gap-2 mt-1">
            {score !== null && (
              <span className="text-2xl font-extrabold" style={{ color: verdict.color }}>{score}</span>
            )}
            <Badge style={{ background: verdict.bg, color: verdict.color, border: "none" }}>
              {verdict.label}
            </Badge>
          </div>
        </div>
      </div>

      {/* Parent */}
      <div className="pt-3 border-t border-border">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Parent Company</p>
        <p className="font-semibold">{parentName}</p>
      </div>

      {/* Siblings */}
      {siblings.length > 0 && (
        <div className="pt-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Also owns</p>
          <div className="flex flex-wrap gap-1.5">
            {siblings.slice(0, 6).map((s) => (
              <Badge key={s.name} variant="outline" className="text-xs">
                {s.name}
              </Badge>
            ))}
            {siblings.length > 6 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                +{siblings.length - 6} more
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-3 border-t border-border flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">Check brands before you buy</p>
        <p className="text-xs font-bold text-primary">Barcode Truth</p>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */
export default function OwnershipTree() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showShareCard, setShowShareCard] = useState(false);
  const [phase, setPhase] = useState(0); // 0=brand, 1=parent reveal, 2=siblings

  // Fetch brand
  const { data: brand, isLoading: brandLoading, error: brandError } = useQuery({
    queryKey: ["ownership-tree-brand", id],
    queryFn: async () => {
      if (!id) return null;
      const { data: bySlug } = await supabase.from("brands").select("*").eq("slug", id).maybeSingle();
      if (bySlug) return bySlug;
      const { data: byId } = await supabase.from("brands").select("*").eq("id", id).maybeSingle();
      return byId;
    },
    enabled: !!id,
    retry: 1,
    staleTime: 1000 * 60 * 10,
  });

  const brandId = brand?.id;

  // Fetch ownership
  const { data: ownership } = useQuery({
    queryKey: ["ownership-tree-data", brandId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_brand_ownership" as any, { p_brand_id: brandId });
      if (error) return null;
      return data as any;
    },
    enabled: !!brandId,
    retry: 1,
  });

  // Fetch score — score column is an integer
  const { data: scoreData } = useQuery({
    queryKey: ["ownership-tree-score", brandId],
    queryFn: async () => {
      const { data } = await supabase
        .from("brand_scores")
        .select("score")
        .eq("brand_id", brandId!)
        .order("last_updated", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.score != null ? Math.round(Number(data.score)) : null;
    },
    enabled: !!brandId,
  });

  // Animate phases
  useEffect(() => {
    if (!ownership) return;
    const t1 = setTimeout(() => setPhase(1), 600);
    const t2 = setTimeout(() => setPhase(2), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [ownership]);

  const chain = ownership?.structure?.chain || [];
  const siblings = (ownership?.structure?.siblings || []).filter(
    (s: any) => s.id !== brandId
  );
  const parentCompany = chain.length > 1 ? chain[chain.length - 1] : null;
  const showParent =
    parentCompany &&
    parentCompany.name?.trim().toLowerCase() !== brand?.name?.trim().toLowerCase();

  const verdict = getVerdict(scoreData ?? null);

  const handleCopyShareCard = useCallback(() => {
    const text = [
      `${brand?.name}`,
      scoreData != null ? `Score: ${scoreData} — ${verdict.label}` : "",
      showParent ? `\nOwned by: ${parentCompany!.name}` : "",
      siblings.length > 0
        ? `\nAlso owns: ${siblings.slice(0, 6).map((s: any) => s.name).join(", ")}${siblings.length > 6 ? ` +${siblings.length - 6} more` : ""}`
        : "",
      "\nChecked with Barcode Truth",
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(text).catch(() => {});
  }, [brand, scoreData, verdict, showParent, parentCompany, siblings]);

  if (brandLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="h-64 w-80" />
      </div>
    );
  }

  if (!brand || brandError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Building2 className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-muted-foreground">Brand not found</p>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>Go back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Subtle background glow */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-20 blur-[120px]"
        style={{ background: verdict.color }}
      />

      <div className="relative z-10 max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/brand/${id}`)}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <motion.h1
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground"
          >
            Who Owns This?
          </motion.h1>
          <div className="w-16" /> {/* spacer */}
        </div>

        {/* ── TREE VISUALIZATION ── */}
        <div className="space-y-0">
          {/* Scanned brand */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-4 p-4 rounded-lg border bg-card/80 backdrop-blur-sm"
          >
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
              {brand.logo_url ? (
                <img
                  src={brand.logo_url}
                  alt={brand.name}
                  className="w-full h-full object-contain p-1"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <span className="text-xl font-bold text-muted-foreground/40">{brand.name[0]}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">You scanned</p>
              <p className="text-lg font-bold truncate">{brand.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <ScoreRing score={scoreData ?? null} verdict={verdict.label} />
              <div className="text-right">
                <p className="text-lg">{getVerdictEmoji(scoreData ?? null)}</p>
                <p className="text-[10px] font-semibold" style={{ color: verdict.color }}>
                  {verdict.label}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Parent reveal */}
          {showParent && (
            <>
              <Connector delay={0.5} />

              <AnimatePresence>
                {phase >= 1 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, type: "spring", stiffness: 180, damping: 18 }}
                  >
                    <div className="text-center mb-2">
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="text-[10px] text-muted-foreground uppercase tracking-[0.15em]"
                      >
                        Owned by
                      </motion.p>
                    </div>

                    <div
                      className="flex flex-col items-center gap-2 p-5 rounded-lg border-2 mx-auto max-w-[200px] cursor-pointer hover:border-primary/50 transition-colors"
                      style={{
                        borderColor: `${verdict.color}44`,
                        background: verdict.bg,
                      }}
                      onClick={() => navigate(`/brand/${parentCompany!.id}`, { state: { fromBrand: true } })}
                    >
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-card flex items-center justify-center">
                        {parentCompany!.logo_url ? (
                          <img src={parentCompany!.logo_url} alt={parentCompany!.name} className="w-full h-full object-contain p-1" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                        ) : (
                          <Building2 className="h-7 w-7 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-base font-bold text-center">{parentCompany!.name}</p>
                      {siblings.length > 0 && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.4 }}
                          className="text-[10px] text-muted-foreground"
                        >
                          Owns {siblings.length + 1}+ brands worldwide
                        </motion.p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {/* Siblings */}
          {siblings.length > 0 && showParent && (
            <>
              <Connector delay={1.2} height={20} />

              <AnimatePresence>
                {phase >= 2 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-3"
                  >
                    <p className="text-center text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                      Also owned by {parentCompany!.name}
                    </p>

                    <div className="grid grid-cols-3 gap-2">
                      {siblings.slice(0, 9).map((sib: any, i: number) => (
                        <TreeNode
                          key={sib.id}
                          name={sib.name}
                          logoUrl={sib.logo_url}
                          delay={1.5 + i * 0.08}
                          onClick={() => navigate(`/brand/${sib.id}`, { state: { fromBrand: true } })}
                        />
                      ))}
                    </div>

                    {siblings.length > 9 && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 2.2 }}
                        className="text-center text-xs text-muted-foreground"
                      >
                        + {siblings.length - 9} more brands
                      </motion.p>
                    )}

                    {/* Total count banner */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 2.0 }}
                      className="text-center py-3 rounded-lg border border-border bg-card/50"
                    >
                      <p className="text-xs text-muted-foreground">
                        Total brands in this corporate family:{" "}
                        <span className="font-bold text-foreground">{siblings.length + 1}</span>
                      </p>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {/* No parent state */}
          {!showParent && !brandLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-center py-8"
            >
              <Building2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {brand.name} appears to operate independently
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                No parent corporation detected
              </p>
            </motion.div>
          )}
        </div>

        {/* ── ACTIONS ── */}
        {showParent && phase >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.3 }}
            className="flex gap-2"
          >
            <Button
              className="flex-1 gap-2"
              onClick={() => {
                setShowShareCard(!showShareCard);
              }}
            >
              <Share2 className="h-4 w-4" />
              {showShareCard ? "Hide" : "Generate Share Card"}
            </Button>
          </motion.div>
        )}

        {/* ── SHARE CARD ── */}
        <AnimatePresence>
          {showShareCard && showParent && (
            <div className="space-y-3">
              <ShareCard
                brandName={brand.name}
                score={scoreData ?? null}
                verdict={verdict}
                parentName={parentCompany!.name}
                siblings={siblings}
              />
              <Button variant="outline" size="sm" className="w-full" onClick={handleCopyShareCard}>
                📋 Copy as text
              </Button>
              <p className="text-center text-[10px] text-muted-foreground">
                Screenshot this card and share it on social media
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
